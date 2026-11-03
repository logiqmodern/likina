import { lt, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { rateLimits } from "@/db/schema";
import { sha256 } from "./crypto";

export interface RateLimitRule {
  /** e.g. "hold", "confirm", "inquiry" */
  name: string;
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  hold: { name: "hold", limit: 20, windowSeconds: 600 },
  confirm: { name: "confirm", limit: 10, windowSeconds: 600 },
  manage: { name: "manage", limit: 30, windowSeconds: 600 },
  inquiry: { name: "inquiry", limit: 5, windowSeconds: 600 },
  /** promo code checks on the booking form (no guessing codes) */
  promo: { name: "promo", limit: 15, windowSeconds: 600 },
  /** anonymous funnel counter (booking_start) */
  funnel: { name: "funnel", limit: 30, windowSeconds: 600 },
  /** admin login, per IP */
  login: { name: "login", limit: 10, windowSeconds: 600 },
  /** admin login, per e-mail address (lower-cased) */
  loginEmail: { name: "login-email", limit: 5, windowSeconds: 900 },
  /** admin 2FA code checks (verify and enrolment), per user */
  mfa: { name: "mfa", limit: 5, windowSeconds: 600 },
} satisfies Record<string, RateLimitRule>;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window counter in Postgres (one atomic upsert per hit). `subject` is
 * hashed so no IP address or phone number is stored.
 */
export async function hitRateLimit(
  db: Database,
  rule: RateLimitRule,
  subject: string,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const key = `${rule.name}:${sha256(subject)}`;

  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });

  const count = row?.count ?? 1;
  const retryAfterSeconds = Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000);
  return { ok: count <= rule.limit, remaining: Math.max(0, rule.limit - count), retryAfterSeconds };
}

/** Housekeeping for the worker: drop windows older than a day. */
export async function pruneRateLimits(db: Database, now: Date = new Date()): Promise<number> {
  const rows = await db
    .delete(rateLimits)
    .where(lt(rateLimits.windowStart, new Date(now.getTime() - 24 * 3600 * 1000)))
    .returning({ key: rateLimits.key });
  return rows.length;
}
