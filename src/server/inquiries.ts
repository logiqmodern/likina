import { z } from "zod";
import { enqueueInquiry } from "./email/outbox";
import type { Database } from "@/db/client";
import { inquiries, inquiryType } from "@/db/schema";
import { normalizePhone } from "@/domain/phone";
import {
  HONEYPOT_FIELD,
  INQUIRY_FIELD_RULES,
  INQUIRY_FIELDS,
  INQUIRY_MAX_LENGTH,
  type InquiryField,
  type InquiryType,
} from "@/lib/inquiry-fields";

// Compile-time guard: the shared list must match the DB enum exactly (both directions).
type DbInquiryType = (typeof inquiryType.enumValues)[number];
const _sameTypes: [DbInquiryType, InquiryType] = ["" as InquiryType, "" as DbInquiryType];
void _sameTypes;

/** Anything with FormData's `get`, or a plain object (tests, JSON). */
export type InquiryInput = { get(name: string): unknown } | Record<string, unknown>;

export type InquiryPayload = Partial<Record<InquiryField, string>>;

export type InquiryValidation =
  | { ok: true; spam: false; data: InquiryPayload }
  | { ok: true; spam: true }
  | { ok: false; errors: Partial<Record<InquiryField, string>>; values: Partial<Record<InquiryField, string>> };

const REQUIRED_MESSAGES_BG: Record<InquiryField, string> = {
  name: "Въведете име",
  phone: "Въведете телефонен номер",
  email: "Въведете имейл",
  subject: "Опишете образа или светията",
  size: "Въведете размер",
  deadline: "Въведете срок",
  message: "Напишете съобщение",
  artwork: "Изберете творба",
};

const REQUIRED_MESSAGES_EN: Record<InquiryField, string> = {
  name: "Enter your name",
  phone: "Enter a phone number",
  email: "Enter your e-mail",
  subject: "Describe the saint or image",
  size: "Enter a size",
  deadline: "Enter the timing",
  message: "Write a message",
  artwork: "Choose an artwork",
};

/** Error texts per page language (§6.2: errors in the language of the page). */
const MESSAGES = {
  bg: {
    required: REQUIRED_MESSAGES_BG,
    phone: "Въведете валиден телефонен номер",
    email: "Въведете валиден имейл адрес",
    tooLong: (max: number) => `Най-много ${max} знака`,
  },
  en: {
    required: REQUIRED_MESSAGES_EN,
    phone: "Enter a valid phone number",
    email: "Enter a valid e-mail address",
    tooLong: (max: number) => `At most ${max} characters`,
  },
} as const;
type Lang = keyof typeof MESSAGES;

const emailFormat = z.email();

/** Schema for one field; input is always a (possibly empty) string. */
function fieldSchema(field: InquiryField, required: boolean, lang: Lang): z.ZodType<string> {
  const m = MESSAGES[lang];
  const max = INQUIRY_MAX_LENGTH[field];
  let s = z.string().trim();
  if (required) s = s.min(1, { error: m.required[field] });
  s = s.max(max, { error: m.tooLong(max) });

  switch (field) {
    case "phone":
      return s
        .refine((v) => v === "" || normalizePhone(v) !== null, { error: m.phone })
        .transform((v) => (v === "" ? "" : (normalizePhone(v) ?? "")));
    case "email":
      return s.refine((v) => v === "" || emailFormat.safeParse(v).success, { error: m.email });
    default:
      return s;
  }
}

function buildSchema(type: InquiryType, lang: Lang) {
  const shape: Partial<Record<InquiryField, z.ZodType<string>>> = {};
  for (const [field, rule] of Object.entries(INQUIRY_FIELD_RULES[type]) as Array<[InquiryField, "required" | "optional"]>) {
    shape[field] = fieldSchema(field, rule === "required", lang);
  }
  return z.object(shape);
}

function read(input: InquiryInput, name: string): string {
  const raw = typeof input.get === "function" ? (input as { get(n: string): unknown }).get(name) : (input as Record<string, unknown>)[name];
  return typeof raw === "string" ? raw : "";
}

/**
 * Pure validation of an inquiry form (§4.4). Field errors in the page language.
 * A filled honeypot is reported as spam: the caller answers with success and stores nothing.
 */
export function validateInquiry(type: InquiryType, input: InquiryInput, lang: Lang = "bg"): InquiryValidation {
  if (read(input, HONEYPOT_FIELD).trim() !== "") return { ok: true, spam: true };

  const allowed = Object.keys(INQUIRY_FIELD_RULES[type]) as InquiryField[];
  const values: Partial<Record<InquiryField, string>> = {};
  for (const field of allowed) values[field] = read(input, field);

  const result = buildSchema(type, lang).safeParse(values);
  if (!result.success) {
    const errors: Partial<Record<InquiryField, string>> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && (INQUIRY_FIELDS as readonly string[]).includes(field)) {
        errors[field as InquiryField] ??= issue.message; // first problem per field
      }
    }
    return { ok: false, errors, values };
  }

  // Drop empty optional fields so the stored payload stays clean.
  const data: InquiryPayload = {};
  for (const [field, value] of Object.entries(result.data) as Array<[InquiryField, string | undefined]>) {
    if (value) data[field] = value;
  }
  return { ok: true, spam: false, data };
}

/** Stores a validated inquiry; it shows up in the admin as status "new" (Phase 5). */
export async function saveInquiry(
  db: Database,
  type: InquiryType,
  payload: InquiryPayload,
): Promise<{ id: string; emailIds: string[] }> {
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(inquiries).values({ type, payload }).returning({ id: inquiries.id });
    if (!row) throw new Error("inquiry insert returned no row");
    const emailId = await enqueueInquiry(tx, row.id, new Date());
    return { id: row.id, emailIds: emailId ? [emailId] : [] };
  });
}
