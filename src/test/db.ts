import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";

/** Integration tests run only when DATABASE_URL points at a migrated database. */
export const hasDatabase = !!process.env.DATABASE_URL;

export function createTestDb(): { db: Database; pool: Pool } {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 20 });
  return { db: drizzle({ client: pool, schema }), pool };
}

export async function resetDb(db: Database): Promise<void> {
  await db.execute(sql`
    TRUNCATE consent_records, funnel_counts, email_messages, email_templates, content_items, media, admin_invites,
             inquiries, audit_log, settings, rate_limits
    RESTART IDENTITY CASCADE
  `);
}
