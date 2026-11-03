import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { seed } from "../src/db/seed";

async function main() {
  // Migrations/seed need a direct (unpooled) connection when a pooler is in front (Neon on Vercel).
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. On Vercel: Settings → Environment Variables → add DATABASE_URL (pooled) and DATABASE_URL_UNPOOLED (direct) from the Neon console, then redeploy.",
    );
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    const db = drizzle({ client: pool, schema });
    const summary = await seed(db);
    console.log("[seed] done", summary);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[seed] failed", error);
  process.exit(1);
});
