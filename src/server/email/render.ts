import { render } from "@react-email/components";
import { eq } from "drizzle-orm";
import { createElement } from "react";
import type { Database } from "@/db/client";
import { emailMessages, inquiries } from "@/db/schema";
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

export async function renderMessage(db: Database, msg: Message, cfg: EmailConfig, now: Date): Promise<RenderResult> {
  void now;
  switch (msg.kind) {
    case "order_confirmed":
    case "order_payment_failed":
    case "order_shipped":
    case "order_cancelled":
    case "seller_new_order":
    case "seller_payment_failed":
      return { ok: false, skip: "имейлите за поръчки идват във Фаза 1" };
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
