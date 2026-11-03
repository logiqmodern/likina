import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { serverEnv } from "@/lib/env";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { pgPool?: Pool; db?: Database };

export function getPool(): Pool {
  globalForDb.pgPool ??= new Pool({
    connectionString: serverEnv().DATABASE_URL,
    max: 10,
  });
  return globalForDb.pgPool;
}

export function getDb(): Database {
  globalForDb.db ??= drizzle({ client: getPool(), schema });
  return globalForDb.db;
}
