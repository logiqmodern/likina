import { execFileSync } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { Client } from "pg";
import { E2E_ENV } from "./env";

/**
 * Runs BEFORE Playwright (npm run e2e): Playwright starts the web server before
 * any globalSetup, so the database must exist first. Fresh, migrated and
 * seeded database + static assets next to the standalone server.
 */
async function prepare() {
  if (!existsSync(".next/standalone/server.js")) {
    throw new Error("Run `npm run build` before the E2E tests.");
  }
  cpSync("public", ".next/standalone/public", { recursive: true });
  cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });

  const url = new URL(E2E_ENV.DATABASE_URL);
  const dbName = url.pathname.slice(1);
  const admin = new Client({ connectionString: Object.assign(new URL(url), { pathname: "/postgres" }).toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  const env = { ...process.env, DATABASE_URL: E2E_ENV.DATABASE_URL };
  execFileSync("npx", ["tsx", "scripts/migrate.ts"], { env, stdio: "inherit" });
  execFileSync("npx", ["tsx", "scripts/seed.ts"], { env, stdio: "inherit" });
}

prepare().catch((error) => {
  console.error("[e2e] prepare failed", error);
  process.exit(1);
});
