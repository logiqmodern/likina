import { and, asc, eq, inArray, lt, lte, or, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { emailMessages } from "@/db/schema";
import { type EmailConfig, loadEmailConfig } from "./config";
import { raiseAlert } from "./outbox";
import { renderMessage } from "./render";
import { type EmailTransport, TransportError } from "./transport";

/*
 * Delivery of the outbox. Safe to run from several places at once (the
 * request that queued a message, the worker, the cron route): rows are
 * claimed with FOR UPDATE SKIP LOCKED, and Resend's idempotency key (the
 * message id) stops a double send after a crash.
 */

/** Wait before attempt n+1 (minutes). After the last one the message fails. */
export const RETRY_MINUTES = [1, 5, 30, 120, 360] as const;
export const MAX_ATTEMPTS = RETRY_MINUTES.length + 1;
const STALE_LOCK_MS = 10 * 60_000;

export interface DeliveryReport {
  sent: number;
  skipped: number;
  retried: number;
  failed: number;
}

/** Claims up to `limit` due messages (optionally only `ids`) and sends them. */
export async function deliverDue(
  db: Database,
  transport: EmailTransport,
  opts: { now: Date; ids?: string[]; limit?: number; config?: EmailConfig },
): Promise<DeliveryReport> {
  const report: DeliveryReport = { sent: 0, skipped: 0, retried: 0, failed: 0 };
  if (opts.ids && opts.ids.length === 0) return report;
  const now = opts.now;

  // A sender that died mid-way leaves "sending" rows: give them back after 10 minutes.
  await db
    .update(emailMessages)
    .set({ status: "queued", lockedAt: null })
    .where(and(eq(emailMessages.status, "sending"), lt(emailMessages.lockedAt, new Date(now.getTime() - STALE_LOCK_MS))));

  const claimed = await db.transaction(async (tx) => {
    const due = await tx
      .select({ id: emailMessages.id })
      .from(emailMessages)
      .where(
        and(
          eq(emailMessages.status, "queued"),
          lte(emailMessages.sendAfter, now),
          opts.ids ? inArray(emailMessages.id, opts.ids) : undefined,
        ),
      )
      .orderBy(asc(emailMessages.sendAfter))
      .limit(opts.limit ?? 25)
      .for("update", { skipLocked: true });
    if (due.length === 0) return [];
    return tx
      .update(emailMessages)
      .set({ status: "sending", lockedAt: now, attempts: sql`${emailMessages.attempts} + 1` })
      .where(inArray(emailMessages.id, due.map((d) => d.id)))
      .returning();
  });
  if (claimed.length === 0) return report;

  const config = opts.config ?? (await loadEmailConfig(db));
  for (const msg of claimed) {
    try {
      const r = await renderMessage(db, msg, config, now);
      if (!r.ok) {
        await db
          .update(emailMessages)
          .set({ status: "skipped", lockedAt: null, lastError: r.skip })
          .where(eq(emailMessages.id, msg.id));
        report.skipped++;
        continue;
      }
      const { id } = await transport.send({
        from: config.from,
        to: msg.toAddress,
        replyTo: config.replyTo,
        subject: r.email.subject,
        html: r.email.html,
        text: r.email.text,
        attachments: r.email.attachments,
        idempotencyKey: msg.id,
        tags: { kind: msg.kind },
      });
      await db
        .update(emailMessages)
        .set({
          status: transport.name === "log" ? "logged" : "sent",
          providerId: id,
          subject: r.email.subject,
          textBody: r.email.text.slice(0, 20_000),
          sentAt: now,
          lockedAt: null,
          lastError: null,
        })
        .where(eq(emailMessages.id, msg.id));
      report.sent++;
    } catch (error) {
      const retryable = !(error instanceof TransportError) || error.retryable;
      const message = (error as Error).message.slice(0, 500);
      if (retryable && msg.attempts < MAX_ATTEMPTS) {
        const wait = RETRY_MINUTES[msg.attempts - 1] ?? RETRY_MINUTES.at(-1)!;
        await db
          .update(emailMessages)
          .set({ status: "queued", lockedAt: null, lastError: message, sendAfter: new Date(now.getTime() + wait * 60_000) })
          .where(eq(emailMessages.id, msg.id));
        report.retried++;
      } else {
        await db
          .update(emailMessages)
          .set({ status: "failed", lockedAt: null, lastError: message })
          .where(eq(emailMessages.id, msg.id));
        report.failed++;
        // An alert about a failed alert would loop.
        if (msg.kind !== "alert") {
          await raiseAlert(db, {
            topic: "email-failed",
            subject: "Имейл не можа да бъде изпратен",
            lines: [`Вид: ${msg.kind}`, `До: ${msg.toAddress}`, `Грешка: ${message}`, "Виж Админ → Имейл шаблони → Изпратени."],
            now,
            to: config.alert,
          });
        }
      }
    }
  }
  return report;
}

export async function runEmailTick(db: Database, transport: EmailTransport, now: Date) {
  return deliverDue(db, transport, { now, limit: 50 });
}

/** Admin: put a failed / skipped message back in the queue. */
export async function requeueMessage(db: Database, id: string, now: Date): Promise<boolean> {
  const r = await db
    .update(emailMessages)
    .set({ status: "queued", sendAfter: now, lastError: null, lockedAt: null, attempts: 0 })
    .where(and(eq(emailMessages.id, id), or(eq(emailMessages.status, "failed"), eq(emailMessages.status, "bounced"))))
    .returning({ id: emailMessages.id });
  return r.length > 0;
}
