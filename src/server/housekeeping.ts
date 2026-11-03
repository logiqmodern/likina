import type { Database } from "@/db/client";
import { pruneAdminSessions } from "./admin/session";
import { pruneRateLimits } from "./rate-limit";

/**
 * Nightly clean-up: expired admin sessions and old rate-limit windows. Data
 * retention for orders (§14) arrives with the orders. On Vercel the daily cron
 * (/api/cron/emails) runs it after the e-mails.
 */
export async function runHousekeeping(db: Database, now: Date) {
  const sessions = await pruneAdminSessions(db, now);
  const rateLimitWindows = await pruneRateLimits(db, now);
  return { sessions, rateLimitWindows };
}
