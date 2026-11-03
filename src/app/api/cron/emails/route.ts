import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { serverEnv } from "@/lib/env";
import { runEmailTick } from "@/server/email/deliver";
import { transportFromEnv } from "@/server/email/transport";
import { runHousekeeping } from "@/server/housekeeping";

/**
 * GET /api/cron/emails — reminders, daily schedule, retries, then the nightly
 * housekeeping (sessions, rate limits, data retention). Called by Vercel
 * Cron (vercel.json) while the site runs there; on the VPS the worker does the
 * same every minute. Requires `Authorization: Bearer <CRON_SECRET>`; without
 * CRON_SECRET configured the route refuses (fails closed).
 */
export const maxDuration = 60;

function authorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  await connection();
  const env = serverEnv();
  if (!authorized(request.headers.get("authorization"), env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const db = getDb();
  const emails = await runEmailTick(db, transportFromEnv(env.RESEND_API_KEY), new Date());
  // Vercel runs this once a day; the VPS worker has its own nightly housekeeping job.
  const housekeeping = await runHousekeeping(db, new Date()).catch((error: unknown) => {
    console.error("[cron] housekeeping failed", error);
    return null;
  });
  return Response.json({ ...emails, housekeeping }, { headers: { "Cache-Control": "no-store" } });
}
