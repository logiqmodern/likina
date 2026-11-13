import { createSign, createVerify } from "node:crypto";

/*
 * myPOS Checkout (IPC v1.4, §6.4). Signature per the official docs
 * (developers.mypos.com → Checkout API → Authentication): all POST values
 * except Signature, joined with "-" in the order they are sent, Base64-encoded,
 * signed with RSA-SHA256, the signature Base64-encoded and sent last.
 * Notifications from myPOS are verified the same way with the myPOS certificate.
 *
 * Configuration: MYPOS_CONFIG_PACK — the base64 "configuration pack" from the
 * myPOS account (Store ID, client number, our private key, the myPOS
 * certificate, key index); MYPOS_MODE = test | production. Without a pack,
 * card payment is simply not offered (TODO-CLIENT, OPEN-QUESTIONS Q13).
 */

export interface MyposConfig {
  sid: string;
  walletNumber: string;
  privateKey: string;
  myposCert: string;
  keyIndex: string;
  url: string;
}

const URLS = { test: "https://www.mypos.com/vmp/checkout-test", production: "https://www.mypos.com/vmp/checkout" } as const;

export function myposConfig(env: Record<string, string | undefined> = process.env): MyposConfig | null {
  const pack = env.MYPOS_CONFIG_PACK?.trim();
  if (!pack) return null;
  try {
    const p = JSON.parse(Buffer.from(pack, "base64").toString("utf8")) as Record<string, unknown>;
    const cfg = {
      sid: String(p.sid ?? ""),
      walletNumber: String(p.cn ?? ""),
      privateKey: String(p.pk ?? ""),
      myposCert: String(p.pc ?? ""),
      keyIndex: String(p.idx ?? ""),
      url: env.MYPOS_MODE === "production" ? URLS.production : URLS.test,
    };
    return cfg.sid && cfg.walletNumber && cfg.privateKey && cfg.myposCert && cfg.keyIndex ? cfg : null;
  } catch {
    console.error("[mypos] MYPOS_CONFIG_PACK is not a valid configuration pack");
    return null;
  }
}

export type Params = Array<[string, string]>;

function payload(params: Params): string {
  return Buffer.from(params.map(([, v]) => v).join("-"), "utf8").toString("base64");
}

export function signParams(params: Params, privateKeyPem: string): string {
  return createSign("RSA-SHA256").update(payload(params)).sign(privateKeyPem, "base64");
}

export function verifyParams(params: Params, signature: string, publicPem: string): boolean {
  try {
    return createVerify("RSA-SHA256").update(payload(params)).verify(publicPem, signature, "base64");
  } catch {
    return false;
  }
}

/** "45000" cents → "450.00" */
export function amount(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Parses a myPOS amount ("450.00") into cents; null if malformed. */
export function amountToCents(value: string | null): number | null {
  if (!value || !/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [w, f = ""] = value.split(".");
  return Number(w) * 100 + Number(f.padEnd(2, "0"));
}

/** Signed form fields for IPCPurchase (one cart line: the whole order). */
export function purchaseFields(
  cfg: MyposConfig,
  order: { number: string; totalCents: number; email: string; lang: "bg" | "en" },
  urls: { ok: string; cancel: string; notify: string },
): Params {
  const params: Params = [
    ["IPCmethod", "IPCPurchase"],
    ["IPCVersion", "1.4"],
    ["IPCLanguage", order.lang === "bg" ? "BG" : "EN"],
    ["SID", cfg.sid],
    ["walletnumber", cfg.walletNumber],
    ["Amount", amount(order.totalCents)],
    ["Currency", "EUR"],
    ["OrderID", order.number],
    ["URL_OK", urls.ok],
    ["URL_Cancel", urls.cancel],
    ["URL_Notify", urls.notify],
    ["CardTokenRequest", "0"],
    ["KeyIndex", cfg.keyIndex],
    ["PaymentParametersRequired", "2"],
    ["customeremail", order.email],
    ["CartItems", "1"],
    ["Article_1", `Likina ${order.number}`],
    ["Quantity_1", "1"],
    ["Price_1", amount(order.totalCents)],
    ["Currency_1", "EUR"],
    ["Amount_1", amount(order.totalCents)],
  ];
  return [...params, ["Signature", signParams(params, cfg.privateKey)]];
}

/** A verified notification from myPOS, or null if the signature does not match. */
export function readNotification(body: URLSearchParams, cfg: MyposConfig) {
  const all = [...body.entries()];
  const signature = body.get("Signature");
  if (!signature) return null;
  const signed = all.filter(([k]) => k !== "Signature");
  if (!verifyParams(signed, signature, cfg.myposCert)) return null;
  return {
    method: body.get("IPCmethod") ?? "",
    orderNumber: body.get("OrderID") ?? "",
    amountCents: amountToCents(body.get("Amount")),
    currency: body.get("Currency") ?? "",
    transactionRef: body.get("IPC_Trnref") ?? body.get("RequestSTAN") ?? "",
    raw: Object.fromEntries(signed) as Record<string, unknown>,
  };
}
