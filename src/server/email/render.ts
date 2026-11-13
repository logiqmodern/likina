import { render } from "@react-email/components";
import { eq } from "drizzle-orm";
import { createElement } from "react";
import type { Database } from "@/db/client";
import { emailMessages, inquiries, orderItems, orders } from "@/db/schema";
import { formatEur } from "@/domain/pricing";
import { StudioEmail, type StudioEmailModel, studioEmailText } from "@/emails/studio-email";
import { INQUIRY_FIELDS } from "@/lib/inquiry-fields";
import type { EmailConfig } from "./config";

/*
 * Renders a queued message at send time. Customer order e-mails (BG/EN) are
 * built with the orders in Phase 1/6; until then those kinds are skipped.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{ filename: string; content: string; contentType: string }>;
}
export type RenderResult = { ok: true; email: RenderedEmail } | { ok: false; skip: string };

type Message = typeof emailMessages.$inferSelect;

const INQUIRY_TITLES: Record<string, string> = {
  custom_icon: "Икона по поръчка",
  contact: "Контакт",
  similar_artwork: "Подобна творба",
};
const INQUIRY_FIELD_LABELS: Record<string, string> = {
  name: "Име",
  phone: "Телефон",
  email: "Имейл",
  subject: "Образ / светия",
  size: "Размер",
  deadline: "Срок",
  message: "Съобщение",
  artwork: "Творба",
};

async function renderSeller(subject: string, m: StudioEmailModel): Promise<RenderedEmail> {
  const html = await render(createElement(StudioEmail, { m }));
  return { subject, html, text: studioEmailText(m) };
}

async function renderInquiry(db: Database, msg: Message, cfg: EmailConfig): Promise<RenderResult> {
  const { inquiryId } = msg.payload as { inquiryId: string };
  const [q] = await db.select().from(inquiries).where(eq(inquiries.id, inquiryId));
  if (!q) return { ok: false, skip: "запитването е изтрито" };
  const p = q.payload;
  const rows = INQUIRY_FIELDS.filter((f) => typeof p[f] === "string" && (p[f] as string).trim()).map((f) => ({
    label: INQUIRY_FIELD_LABELS[f] ?? f,
    value: String(p[f]),
  }));
  const title = INQUIRY_TITLES[q.type] ?? q.type;
  return {
    ok: true,
    email: await renderSeller(`Ново запитване (${title}): ${String(p.name ?? "")}`, {
      heading: `Ново запитване: ${title}`,
      rows,
      link: { label: "Отвори запитванията", url: `${cfg.appUrl}/admin/zapitvaniya` },
    }),
  };
}

const DELIVERY = {
  bg: { econt_office: "Еконт — до офис", econt_address: "Еконт — до адрес", econt_locker: "Еконтомат", pickup: "Вземане от ателието" },
  en: { econt_office: "Econt — to an office", econt_address: "Econt — to an address", econt_locker: "Econtomat locker", pickup: "Atelier pick-up" },
} as const;
const PAYMENT = {
  bg: { mypos: "Карта (myPOS) — платено", cod: "Наложен платеж", on_pickup: "Плащане при вземане" },
  en: { mypos: "Card (myPOS) — paid", cod: "Cash on delivery", on_pickup: "Pay on pick-up" },
} as const;

/** Order confirmation to the customer (order language) and the new-order notice to the seller (BG). */
async function renderOrder(db: Database, msg: Message, cfg: EmailConfig): Promise<RenderResult> {
  if (!msg.orderId) return { ok: false, skip: "няма поръчка" };
  const [o] = await db.select().from(orders).where(eq(orders.id, msg.orderId));
  if (!o) return { ok: false, skip: "поръчката е изтрита" };
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
  const seller = msg.kind === "seller_new_order";
  const lang = seller ? "bg" : o.locale;
  const eur = (c: number) => formatEur(c, lang);
  const place = [o.delivery.city, o.delivery.postCode, o.delivery.officeName, o.delivery.address].filter(Boolean).join(", ");
  const itemRows = items.map((i) => ({ label: (lang === "en" && i.titleEn) || i.titleBg, value: eur(i.lineTotalCents) }));
  const totals = [
    ...(o.discountCents ? [{ label: lang === "bg" ? "Отстъпка" : "Discount", value: `−${eur(o.discountCents)}` }] : []),
    { label: lang === "bg" ? "Доставка" : "Delivery", value: lang === "bg" ? "Безплатна" : "Free" },
    { label: lang === "bg" ? "Общо" : "Total", value: eur(o.totalCents) },
    { label: lang === "bg" ? "Доставка до" : "Deliver to", value: `${DELIVERY[lang][o.deliveryMethod]}${place ? ` — ${place}` : ""}` },
    { label: lang === "bg" ? "Плащане" : "Payment", value: PAYMENT[lang][o.paymentMethod] },
  ];

  if (seller) {
    return {
      ok: true,
      email: await renderSeller(`Нова поръчка ${o.number}: ${eur(o.totalCents)} — ${o.customerName}`, {
        heading: `Нова поръчка ${o.number}`,
        rows: [
          { label: "Клиент", value: o.customerName },
          { label: "Телефон", value: o.phone },
          { label: "Имейл", value: o.email },
          ...itemRows,
          ...totals,
          ...(o.notesClient ? [{ label: "Бележка", value: o.notesClient }] : []),
          ...(o.invoice ? [{ label: "Фактура", value: `${o.invoice.company}, ЕИК ${o.invoice.eik}, МОЛ ${o.invoice.mol}, ${o.invoice.address}` }] : []),
          { label: "Език", value: o.locale.toUpperCase() },
        ],
        link: { label: "Отвори админа", url: `${cfg.appUrl}/admin` },
      }),
    };
  }

  const next =
    o.deliveryMethod === "pickup"
      ? lang === "bg"
        ? "Ще се свържем с Вас, за да уговорим удобен час за вземане от ателието."
        : "We will contact you to arrange a time to collect your order from the atelier."
      : lang === "bg"
        ? "Изпращаме с Еконт до 2–3 работни дни. Ще получите номер на пратката."
        : "We ship with Econt within 2–3 working days. You will receive the tracking number.";
  const m = {
    heading: lang === "bg" ? `Благодарим за поръчката! (${o.number})` : `Thank you for your order! (${o.number})`,
    lines: [
      lang === "bg" ? `Здравейте, ${o.customerName},` : `Hello ${o.customerName},`,
      lang === "bg" ? "получихме поръчката Ви." : "we have received your order.",
      next,
      lang === "bg" ? "Въпроси? Отговорете на този имейл или се обадете на +359 899 857 525." : "Questions? Reply to this e-mail or call +359 899 857 525.",
    ],
    rows: [...itemRows, ...totals],
    footer: lang === "bg" ? "Ателие Ликина · likina.com" : "Likina atelier · likina.com",
  };
  const html = await render(createElement(StudioEmail, { m }));
  return { ok: true, email: { subject: m.heading, html, text: studioEmailText(m) } };
}

export async function renderMessage(db: Database, msg: Message, cfg: EmailConfig, now: Date): Promise<RenderResult> {
  void now;
  switch (msg.kind) {
    case "order_confirmed":
    case "seller_new_order":
      return renderOrder(db, msg, cfg);
    case "order_payment_failed":
    case "order_shipped":
    case "order_cancelled":
    case "seller_payment_failed":
      return { ok: false, skip: "този вид имейл идва във v1.1" };
    case "seller_inquiry":
      return renderInquiry(db, msg, cfg);
    case "alert": {
      const p = msg.payload as { subject?: string; lines?: string[] };
      return {
        ok: true,
        email: await renderSeller(`[Сигнал] ${p.subject ?? "Проблем"}`, { heading: p.subject ?? "Проблем", lines: p.lines ?? [] }),
      };
    }
    case "test":
      return { ok: true, email: await renderSeller("[Тест] Likina", { heading: "Тестов имейл", lines: ["Изпращането работи."] }) };
  }
}
