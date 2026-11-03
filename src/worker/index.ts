import { PgBoss } from "pg-boss";
import { getDb } from "@/db/client";
import { APP_TIME_ZONE, serverEnv } from "@/lib/env";
import { runHousekeeping } from "@/server/housekeeping";
import { runEmailTick } from "@/server/email/deliver";
import { raiseAlert } from "@/server/email/outbox";
import { transportFromEnv } from "@/server/email/transport";

/**
 * Background worker — separate process from the web app (docs/PROMPT.md §3).
 * Used on the VPS (Phase 9); on Vercel the cron routes do the same work.
 * Jobs: heartbeat, housekeeping, e-mail delivery with retries. Expired artwork
 * reservations (§5.3) are released here from Phase 1.
 */
export const QUEUES = {
  heartbeat: "heartbeat",
  housekeeping: "housekeeping",
  emails: "emails",
} as const;

async function main() {
  const env = serverEnv();
  const boss = new PgBoss({ connectionString: env.DATABASE_URL, schema: "pgboss" });

  boss.on("error", (error) => {
    console.error("[worker] pg-boss error", error);
    void raiseAlert(getDb(), {
      topic: "worker-error",
      subject: "Грешка във фоновия процес (worker)",
      lines: [String((error as Error)?.message ?? error)],
      now: new Date(),
    }).catch(() => undefined);
  });

  await boss.start();

  await boss.createQueue(QUEUES.heartbeat);
  await boss.schedule(QUEUES.heartbeat, "* * * * *", null, { tz: APP_TIME_ZONE });
  await boss.work(QUEUES.heartbeat, async () => {
    console.log(`[worker] heartbeat ${new Date().toISOString()}`);
  });

  // Nightly: expired admin sessions, old rate-limit windows.
  await boss.createQueue(QUEUES.housekeeping);
  await boss.schedule(QUEUES.housekeeping, "17 3 * * *", null, { tz: APP_TIME_ZONE });
  await boss.work(QUEUES.housekeeping, async () => {
    console.log("[worker] housekeeping", JSON.stringify(await runHousekeeping(getDb(), new Date())));
  });

  // E-mails: deliver the outbox (retries included).
  const transport = transportFromEnv(env.RESEND_API_KEY);
  console.log(`[worker] e-mail transport: ${transport.name}`);
  await boss.createQueue(QUEUES.emails);
  await boss.schedule(QUEUES.emails, "* * * * *", null, { tz: APP_TIME_ZONE });
  await boss.work(QUEUES.emails, async () => {
    const r = await runEmailTick(getDb(), transport, new Date());
    if (r.sent || r.failed || r.retried) console.log("[worker] emails", JSON.stringify(r));
  });

  console.log("[worker] started");

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal} received, stopping`);
    await boss.stop({ graceful: true, timeout: 20_000 });
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  console.error("[worker] fatal", error);
  process.exit(1);
});
