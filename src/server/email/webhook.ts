import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, notInArray } from "drizzle-orm";
import type { Database } from "@/db/client";
import { emailMessages } from "@/db/schema";

/*
 * Resend webhooks (delivery / bounce / complaint) — signed with Svix:
 * HMAC-SHA256 over "<svix-id>.<svix-timestamp>.<raw body>" with the
 * base64 secret after "whsec_"; header "svix-signature: v1,<base64> …".
 */

const TOLERANCE_S = 5 * 60;

export function verifySvixSignature(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  now: Date,
): boolean {
  if (!headers.id || !headers.timestamp || !headers.signature) return false;
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(now.getTime() / 1000 - ts) > TOLERANCE_S) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${headers.id}.${headers.timestamp}.${body}`).digest();
  for (const part of headers.signature.split(" ")) {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) continue;
    const given = Buffer.from(sig, "base64");
    if (given.length === expected.length && timingSafeEqual(given, expected)) return true;
  }
  return false;
}

const FINAL = ["bounced", "complained"] as const;
const EVENT_STATUS: Record<string, "delivered" | "bounced" | "complained"> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

/** Applies a webhook event to the message it belongs to. Returns true when a row changed. */
export async function applyResendEvent(
  db: Database,
  event: { type?: unknown; created_at?: unknown; data?: { email_id?: unknown; bounce?: { message?: unknown } } },
  now: Date,
): Promise<boolean> {
  const status = typeof event.type === "string" ? EVENT_STATUS[event.type] : undefined;
  const emailId = typeof event.data?.email_id === "string" ? event.data.email_id : null;
  if (!status || !emailId) return false;
  const at = typeof event.created_at === "string" && !Number.isNaN(Date.parse(event.created_at)) ? new Date(event.created_at) : now;
  const reason = typeof event.data?.bounce?.message === "string" ? event.data.bounce.message.slice(0, 500) : null;
  const rows = await db
    .update(emailMessages)
    .set({ status, eventAt: at, ...(status !== "delivered" ? { lastError: reason ?? status } : {}) })
    // A bounce / complaint is final: a late "delivered" must not overwrite it.
    .where(and(eq(emailMessages.providerId, emailId), notInArray(emailMessages.status, [...FINAL])))
    .returning({ id: emailMessages.id });
  return rows.length > 0;
}
