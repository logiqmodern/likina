"use server";

import { headers } from "next/headers";
import { getDb } from "@/db/client";
import { FORM_ERROR_KEY, INQUIRY_TYPE_FIELD, isInquiryType, type InquiryFormState } from "@/lib/inquiry-fields";
import { deliverSoon } from "@/server/email/kick";
import { saveInquiry, validateInquiry } from "@/server/inquiries";
import { hitRateLimit, RATE_LIMITS } from "@/server/rate-limit";
import { notifyTelegram } from "@/server/telegram";
import { verifyTurnstile } from "@/server/turnstile";

const FAIL = {
  bg: {
    generic: "Нещо се обърка. Опитайте отново или ни се обадете.",
    rate: "Изпратихте вече няколко запитвания. Опитайте пак след малко или ни се обадете.",
    robot: "Не успяхме да потвърдим, че не сте робот. Опитайте пак или ни се обадете.",
    save: "Не успяхме да изпратим запитването. Опитайте пак след малко или ни се обадете.",
  },
  en: {
    generic: "Something went wrong. Please try again or call us.",
    rate: "You have sent several enquiries already. Please try again later or call us.",
    robot: "We could not confirm you are not a robot. Please try again or call us.",
    save: "We could not send your enquiry. Please try again later or call us.",
  },
} as const;

const TELEGRAM_TITLES = { custom_icon: "Икона по поръчка", contact: "Контакт", similar_artwork: "Подобна творба" } as const;

/** Inquiry forms (contact, custom icon, "order a similar one") — use with `useActionState`. */
export async function submitInquiry(_prev: InquiryFormState, formData: FormData): Promise<InquiryFormState> {
  const lang = formData.get("lang") === "en" ? "en" : "bg";
  const fail = FAIL[lang];
  const type = formData.get(INQUIRY_TYPE_FIELD);
  if (!isInquiryType(type)) return { status: "error", errors: { [FORM_ERROR_KEY]: fail.generic } };

  const result = validateInquiry(type, formData, lang);
  if (!result.ok) return { status: "error", errors: result.errors as Record<string, string>, values: result.values as Record<string, string> };
  if (result.spam) return { status: "success" };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const values = result.data as Record<string, string>;
  if (!(await hitRateLimit(getDb(), RATE_LIMITS.inquiry, ip)).ok) return { status: "error", errors: { [FORM_ERROR_KEY]: fail.rate }, values };
  if (!(await verifyTurnstile(formData.get("turnstileToken") as string | null, ip))) return { status: "error", errors: { [FORM_ERROR_KEY]: fail.robot }, values };

  try {
    const saved = await saveInquiry(getDb(), type, result.data);
    deliverSoon(saved.emailIds);
    notifyTelegram(`📨 Ново запитване (${TELEGRAM_TITLES[type]}): ${values.name ?? ""}${values.subject ? ` — ${values.subject}` : ""}${values.artwork ? ` — ${values.artwork}` : ""}`);
  } catch (error) {
    console.error("inquiry: save failed", { type, error });
    return { status: "error", errors: { [FORM_ERROR_KEY]: fail.save }, values };
  }
  return { status: "success" };
}
