import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { orderItems, orders } from "@/db/schema";
import { CONTACTS_DEFAULT, telHref } from "@/domain/contacts";
import { ORDER_STATUS_LABELS } from "@/domain/orders";
import { formatEur } from "@/domain/pricing";
import { messages, type Lang } from "@/i18n";
import { withPlatformDefaults } from "@/lib/env";
import { isWellFormedToken, sha256 } from "@/server/crypto";
import { myposConfig, purchaseFields } from "@/server/mypos";
import { SiteShell } from "../shell";

/* /porachka/[token] — order status from the database, never from URL parameters (§6.4). */

export async function OrderPage({ lang, token, pay }: { lang: Lang; token: string; pay: boolean }) {
  if (!isWellFormedToken(token)) notFound();
  const db = getDb();
  const [o] = await db.select().from(orders).where(eq(orders.manageTokenHash, sha256(token)));
  if (!o) notFound();
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
  const t = messages[lang].order;
  const tc = messages[lang].cart;

  const cfg = myposConfig();
  const pending = o.status === "pending_payment";
  let payForm: { url: string; fields: Array<[string, string]> } | null = null;
  if (pending && pay && cfg && o.expiresAt && o.expiresAt > new Date()) {
    const base = withPlatformDefaults(process.env).APP_URL ?? "";
    const back = `${base}/api/mypos/return?t=${encodeURIComponent(token)}&l=${lang}`;
    payForm = { url: cfg.url, fields: purchaseFields(cfg, { number: o.number, totalCents: o.totalCents, email: o.email, lang }, { ok: back, cancel: `${back}&c=1`, notify: `${base}/api/mypos/notify` }) };
  }
  const nonce = /'nonce-([^']+)'/.exec((await headers()).get("content-security-policy") ?? "")?.[1];

  const message =
    o.status === "paid" ? t.paid : o.status === "confirmed" ? t.confirmed : o.status === "shipped" ? t.shipped : o.status === "payment_failed" || o.status === "cancelled" ? t.failed : pending ? t.pending : null;

  return (
    <SiteShell lang={lang} alt={lang === "bg" ? `/en/order/${token}` : `/porachka/${token}`}>
      {pending && !payForm ? <meta httpEquiv="refresh" content="5" /> : null}
      <div className="container-site flex max-w-2xl flex-col gap-6 py-10">
        <p className="eyebrow">{t.title(o.number)}</p>
        <h1 className="h1">{o.status === "payment_failed" || o.status === "cancelled" ? ORDER_STATUS_LABELS[o.status][lang] : t.thanks}</h1>
        {message ? <p className="text-[18px] text-ink-2">{message}</p> : null}

        {payForm ? (
          <form id="mypos" method="post" action={payForm.url} className="flex flex-col gap-3">
            {payForm.fields.map(([k, val]) => (
              <input key={k} type="hidden" name={k} value={val} />
            ))}
            <button type="submit" className="btn btn-primary btn-lg">
              {messages[lang].checkout.payCard(formatEur(o.totalCents, lang))}
            </button>
            <script nonce={nonce} dangerouslySetInnerHTML={{ __html: 'document.getElementById("mypos").submit()' }} />
          </form>
        ) : null}

        <dl className="card flex flex-col gap-2 p-5">
          <div className="flex justify-between">
            <dt className="font-semibold">{t.status}</dt>
            <dd>{ORDER_STATUS_LABELS[o.status][lang]}</dd>
          </div>
          {items.map((i) => (
            <div key={i.id} className="flex justify-between gap-4">
              <dt>{(lang === "en" && i.titleEn) || i.titleBg}</dt>
              <dd className="tabular-nums">{formatEur(i.lineTotalCents, lang)}</dd>
            </div>
          ))}
          {o.discountCents ? (
            <div className="flex justify-between">
              <dt>{messages[lang].checkout.discount}</dt>
              <dd className="tabular-nums">−{formatEur(o.discountCents, lang)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-line pt-2 font-extrabold">
            <dt>{tc.total}</dt>
            <dd className="tabular-nums">{formatEur(o.totalCents, lang)}</dd>
          </div>
        </dl>
        <p className="text-ink-2">
          {t.questions}{" "}
          <a href={telHref(CONTACTS_DEFAULT.phone)} className="link font-semibold">
            {CONTACTS_DEFAULT.phone}
          </a>{" "}
          ·{" "}
          <a href={`mailto:${CONTACTS_DEFAULT.email}`} className="link font-semibold">
            {CONTACTS_DEFAULT.email}
          </a>
        </p>
      </div>
    </SiteShell>
  );
}
