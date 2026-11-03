/**
 * Inquiry forms (§4.4, §4.2): field names, per-type requirements and limits.
 * Shared by the server validation (src/server/inquiries.ts) and the client
 * form — keep it free of server imports.
 */

/** Mirrors the `inquiry_type` enum in src/db/schema.ts (checked at compile time in src/server/inquiries.ts). */
export const INQUIRY_TYPES = ["custom_icon", "contact", "similar_artwork"] as const;
export type InquiryType = (typeof INQUIRY_TYPES)[number];

export const INQUIRY_FIELDS = ["name", "phone", "email", "subject", "size", "deadline", "message", "artwork"] as const;
export type InquiryField = (typeof INQUIRY_FIELDS)[number];

/** Which fields each inquiry type accepts, and whether they are required. Others are ignored. */
export const INQUIRY_FIELD_RULES: Record<InquiryType, Partial<Record<InquiryField, "required" | "optional">>> = {
  // „Икона по поръчка“: price and deadline are by agreement (client, 03.11.2026)
  custom_icon: {
    name: "required",
    email: "required",
    phone: "optional",
    subject: "required",
    size: "optional",
    deadline: "optional",
    message: "optional",
  },
  contact: { name: "required", email: "required", phone: "optional", message: "required" },
  // „Поръчай подобна“ from a sold artwork
  similar_artwork: { name: "required", email: "required", phone: "optional", artwork: "required", message: "optional" },
};

export const INQUIRY_MAX_LENGTH: Record<InquiryField, number> = {
  name: 100,
  phone: 40,
  email: 254,
  subject: 200,
  size: 100,
  deadline: 100,
  message: 2000,
  artwork: 200,
};

/** Honeypot: hidden from people; bots that fill it get a fake success and nothing is stored. */
export const HONEYPOT_FIELD = "website";

/** Hidden input carrying the inquiry type to the server action. */
export const INQUIRY_TYPE_FIELD = "inquiryType";

/** Key for errors that are not tied to one field. */
export const FORM_ERROR_KEY = "_form";

export interface InquiryFormState {
  status: "idle" | "error" | "success";
  errors?: Record<string, string>;
  values?: Record<string, string>;
  /** success: id for the analytics event (Pixel + Conversions API share it) */
  eventId?: string;
}

export const INITIAL_INQUIRY_STATE: InquiryFormState = { status: "idle" };

export function isInquiryType(value: unknown): value is InquiryType {
  return typeof value === "string" && (INQUIRY_TYPES as readonly string[]).includes(value);
}
