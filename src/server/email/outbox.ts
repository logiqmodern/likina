import type { Database } from "@/db/client";
import { emailKind, emailMessages } from "@/db/schema";
import { serverEnv } from "@/lib/env";
import { loadSettings } from "../settings";
import { loadContacts } from "./config";

/*
 * Outbox writes. Call inside the transaction that makes the change, so an
 * e-mail exists if and only if the change committed (§17: "имейлите се
 * поставят в опашката"). Delivery happens later (deliver.ts).
 */

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Writer = Database | Tx;
export type EmailKindName = (typeof emailKind.enumValues)[number];

export interface EnqueueInput {
  kind: EmailKindName;
  to: string;
  orderId?: string | null;
  payload?: Record<string, unknown>;
  /** unique: a second enqueue with the same key is ignored */
  dedupeKey?: string | null;
  /** due from (default: `now`) */
  sendAfter?: Date;
  now: Date;
}

/** Returns the new message id, or null when the dedupe key already exists. */
export async function enqueueEmail(db: Writer, input: EnqueueInput): Promise<string | null> {
  const [row] = await db
    .insert(emailMessages)
    .values({
      kind: input.kind,
      toAddress: input.to,
      orderId: input.orderId ?? null,
      payload: input.payload ?? {},
      dedupeKey: input.dedupeKey ?? null,
      sendAfter: input.sendAfter ?? input.now,
      createdAt: input.now,
    })
    .onConflictDoNothing({ target: emailMessages.dedupeKey })
    .returning({ id: emailMessages.id });
  return row?.id ?? null;
}

/** Seller inbox: Settings → env STUDIO_NOTIFY_EMAIL → the contact e-mail. */
export async function sellerAddress(db: Writer): Promise<string | null> {
  const settings = await loadSettings(db as Database);
  if (settings.sellerEmail) return settings.sellerEmail;
  const env = serverEnv().STUDIO_NOTIFY_EMAIL;
  if (env) return env;
  return (await loadContacts(db)).email ?? null;
}

export async function enqueueInquiry(db: Writer, inquiryId: string, now: Date): Promise<string | null> {
  const to = await sellerAddress(db);
  if (!to) return null;
  return enqueueEmail(db, { kind: "seller_inquiry", to, payload: { inquiryId }, now, dedupeKey: `inquiry:${inquiryId}` });
}

/**
 * Developer alert (ALERT_EMAIL). Rate-limited per topic per hour by the dedupe
 * key; without ALERT_EMAIL only logged.
 */
export async function raiseAlert(
  db: Writer,
  input: { topic: string; subject: string; lines: string[]; now: Date; to?: string | null },
): Promise<string | null> {
  console.error(`[alert] ${input.subject} — ${input.lines.join(" | ")}`);
  const to = input.to !== undefined ? input.to : (serverEnv().ALERT_EMAIL ?? null);
  if (!to) return null;
  const hour = input.now.toISOString().slice(0, 13);
  return enqueueEmail(db, {
    kind: "alert",
    to,
    payload: { subject: input.subject, lines: input.lines },
    now: input.now,
    dedupeKey: `alert:${input.topic}:${hour}`,
  });
}
