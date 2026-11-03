import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { invalidOptionalEnv } from "@/lib/env";

/**
 * Uptime probe. `connection()` opts out of build-time prerendering (Cache
 * Components is on), so the database is checked on every request.
 */
export async function GET() {
  await connection();
  const headers = { "Cache-Control": "no-store" };
  const started = Date.now();

  try {
    await getDb().execute(sql`select 1`);
    const invalidConfig = invalidOptionalEnv(); // variable names only
    return Response.json(
      {
        status: invalidConfig.length ? "degraded" : "ok",
        db: "ok",
        dbLatencyMs: Date.now() - started,
        ...(invalidConfig.length ? { invalidConfig } : {}),
      },
      { headers },
    );
  } catch {
    return Response.json({ status: "error", db: "unreachable" }, { status: 503, headers });
  }
}
