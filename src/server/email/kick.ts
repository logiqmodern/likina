import { after } from "next/server";
import { getDb } from "@/db/client";
import { serverEnv } from "@/lib/env";
import { deliverDue } from "./deliver";
import { transportFromEnv } from "./transport";

/**
 * Sends just-queued messages right after the response (Next.js `after`), so
 * the customer gets the confirmation within seconds even where no worker runs
 * (Vercel). Anything that fails here stays queued for the worker / cron retry.
 * Only for Next.js server code (actions, route handlers).
 */
export function deliverSoon(ids: readonly string[]): void {
  if (ids.length === 0) return;
  after(async () => {
    try {
      await deliverDue(getDb(), transportFromEnv(serverEnv().RESEND_API_KEY), { now: new Date(), ids: [...ids] });
    } catch (error) {
      console.error("[email] immediate delivery failed (will retry)", error);
    }
  });
}
