import { existsSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

/**
 * Applies SQL migrations from src/db/migrations. Runs as a one-off container
 * before the app starts (compose service `migrate`) and in CI.
 */
async function main() {
  // Migrations/seed need a direct (unpooled) connection when a pooler is in front (Neon on Vercel).
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. On Vercel: Settings → Environment Variables → add DATABASE_URL (pooled) and DATABASE_URL_UNPOOLED (direct) from the Neon console, then redeploy.",
    );
  }

  const migrationsFolder = path.resolve(process.cwd(), "src/db/migrations");
  if (!existsSync(path.join(migrationsFolder, "meta", "_journal.json"))) {
    console.log("[migrate] no migrations yet — nothing to apply");
    return;
  }

  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder });
    console.log("[migrate] done");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[migrate] failed", error);
  process.exit(1);
});
