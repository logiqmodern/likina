import { z } from "zod";

/**
 * Shop settings editable in the admin (stored in the `settings` table as
 * key → JSON). Defaults reflect the client's answers (docs/PROMPT.md §20).
 */
export const settingsSchema = z.object({
  /** How long artworks stay reserved while a card payment is in progress (§5.3). */
  reservationMinutes: z.number().int().min(5).max(60).default(15),
  /** Shown on artwork pages and in e-mails: "изпраща се до 2–3 работни дни". */
  shipsInDaysMin: z.number().int().min(0).max(30).default(2),
  shipsInDaysMax: z.number().int().min(0).max(60).default(3),
  /** Discount for picking the order up from the atelier, in percent (§6.2). */
  pickupDiscountPercent: z.number().int().min(0).max(50).default(5),
  /** Shipping model (§6.3): included in the artwork price (client decision 03.11.2026). */
  shippingModel: z.enum(["included"]).default("included"),
  /** Where seller notifications go (new order, failed payment, inquiry). null = the contact e-mail. */
  sellerEmail: z.email().nullable().default(null),
  /** GDPR: anonymize order customer data this long after the order (unless kept for accounting). */
  retentionMonths: z.number().int().min(12).max(120).default(60),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});

/**
 * Builds settings from stored key/value rows. Unknown keys are ignored;
 * invalid stored values fall back to the default for that key (and are reported)
 * so one bad admin edit cannot take the shop down.
 */
export function resolveSettings(rows: Array<{ key: string; value: unknown }>): {
  settings: Settings;
  invalidKeys: string[];
} {
  const shape = settingsSchema.shape;
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  const invalidKeys: string[] = [];

  for (const { key, value } of rows) {
    if (!(key in shape)) continue;
    const field = shape[key as keyof typeof shape];
    const parsed = field.safeParse(value);
    if (parsed.success) merged[key] = parsed.data;
    else invalidKeys.push(key);
  }

  return { settings: settingsSchema.parse(merged), invalidKeys };
}
