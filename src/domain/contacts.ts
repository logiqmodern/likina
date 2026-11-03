import { z } from "zod";

/**
 * Seller contacts — one source for the site, e-mails and legal pages (§10.2.9).
 * Stored in `settings` under the key "contacts"; defaults are the data from the
 * old site (likina.com, „Общи условия“ and „Контакти“, read 03.11.2026).
 */
export const contactsSchema = z.object({
  phone: z.string().min(5).max(40),
  email: z.email(),
  street: z.string().min(3).max(200),
  city: z.string().min(2).max(100),
  /** "по предварителна уговорка" */
  hoursBg: z.string().max(200),
  hoursEn: z.string().max(200),
  instagram: z.url().nullable(),
  mapUrl: z.url().nullable(),
});

export type Contacts = z.infer<typeof contactsSchema>;

export const CONTACTS_DEFAULT: Contacts = {
  phone: "+359 899 857 525",
  email: "iconslikina@gmail.com",
  street: "ж.к. Лозенец, ул. Милин камък 12",
  city: "София",
  hoursBg: "По предварителна уговорка",
  hoursEn: "By appointment",
  instagram: "https://www.instagram.com/myartandfaith/",
  mapUrl: "https://www.google.com/maps/place//data=!4m2!3m1!1s0x40aa856323d28c8d:0xb4f2b72616a97251",
};

/** Legal identity of the seller (craftsman, no VAT) — shown on legal pages and invoices. */
export const SELLER = {
  name: "Гергана Руменова Никифорова",
  status: "занаятчия",
  eik: "177641226",
  address: "гр. София, бул. Свети Наум 66",
  vatRegistered: false,
} as const;

export function resolveContacts(value: unknown): Contacts {
  const parsed = contactsSchema.safeParse(value);
  return parsed.success ? parsed.data : CONTACTS_DEFAULT;
}

export function telHref(display: string): string {
  return `tel:${display.replace(/[^\d+]/g, "")}`;
}
