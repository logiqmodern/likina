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

// BG texts („Вие“); the EN form gets its own messages with the i18n work in Phase 4.
const REQUIRED_MESSAGES: Record<InquiryField, string> = {
  name: "Въведете име",
  phone: "Въведете телефонен номер",
  email: "Въведете имейл",
  subject: "Опишете образа или светията",
  size: "Въведете размер",
  deadline: "Въведете срок",
  message: "Напишете съобщение",
  artwork: "Изберете творба",
};

const INVALID_PHONE = "Въведете валиден телефонен номер";
const INVALID_EMAIL = "Въведете валиден имейл адрес";
const tooLong = (max: number) => `Най-много ${max} знака`;

const emailFormat = z.email();

/** Schema for one field; input is always a (possibly empty) string. */
function fieldSchema(field: InquiryField, required: boolean): z.ZodType<string> {
  const max = INQUIRY_MAX_LENGTH[field];
  let s = z.string().trim();
  if (required) s = s.min(1, { error: REQUIRED_MESSAGES[field] });
  s = s.max(max, { error: tooLong(max) });

  switch (field) {
    case "phone":
      return s
        .refine((v) => v === "" || normalizePhone(v) !== null, { error: INVALID_PHONE })
        .transform((v) => (v === "" ? "" : (normalizePhone(v) ?? "")));
    case "email":
      return s.refine((v) => v === "" || emailFormat.safeParse(v).success, { error: INVALID_EMAIL });
    default:
      return s;
  }
}

function buildSchema(type: InquiryType) {
  const shape: Partial<Record<InquiryField, z.ZodType<string>>> = {};
  for (const [field, rule] of Object.entries(INQUIRY_FIELD_RULES[type]) as Array<[InquiryField, "required" | "optional"]>) {
    shape[field] = fieldSchema(field, rule === "required");
  }
  return z.object(shape);
}

export const inquirySchemas: Record<InquiryType, ReturnType<typeof buildSchema>> = {
  custom_icon: buildSchema("custom_icon"),
  contact: buildSchema("contact"),
  similar_artwork: buildSchema("similar_artwork"),
};

function read(input: InquiryInput, name: string): string {
  const raw = typeof input.get === "function" ? (input as { get(n: string): unknown }).get(name) : (input as Record<string, unknown>)[name];
  return typeof raw === "string" ? raw : "";
}

/**
 * Pure validation of an inquiry form (§4.4). Field errors are in Bulgarian.
 * A filled honeypot is reported as spam: the caller answers with success and stores nothing.
 */
export function validateInquiry(type: InquiryType, input: InquiryInput): InquiryValidation {
  if (read(input, HONEYPOT_FIELD).trim() !== "") return { ok: true, spam: true };

  const allowed = Object.keys(INQUIRY_FIELD_RULES[type]) as InquiryField[];
  const values: Partial<Record<InquiryField, string>> = {};
  for (const field of allowed) values[field] = read(input, field);

  const result = inquirySchemas[type].safeParse(values);
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
