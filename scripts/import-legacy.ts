/**
 * Imports the old likina.com catalogue (spec §15.2).
 *
 *   npx tsx scripts/import-legacy.ts --uploads <wp-content/uploads dir> [--catalog data/legacy/catalog.json] [--overwrite] [--report docs/IMPORT-REPORT.md]
 *
 * Uses DATABASE_URL_UNPOOLED ?? DATABASE_URL. Idempotent — safe to run again.
 */
import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { artworksMissingEnglish, importLegacyCatalog, reportMarkdown, type LegacyCatalog } from "../src/server/import/legacy-import";

async function main() {
  const { values } = parseArgs({
    options: {
      uploads: { type: "string" },
      catalog: { type: "string", default: "data/legacy/catalog.json" },
      report: { type: "string", default: "docs/IMPORT-REPORT.md" },
      overwrite: { type: "boolean", default: false },
      verbose: { type: "boolean", default: false },
    },
  });
  if (!values.uploads) throw new Error("--uploads <dir> is required (the wp-content/uploads folder from the backup)");
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const catalog = JSON.parse(await readFile(values.catalog!, "utf8")) as LegacyCatalog;
  const pool = new Pool({ connectionString: url, max: 2 });
  try {
    const db = drizzle({ client: pool, schema });
    const report = await importLegacyCatalog(db, catalog, {
      uploadsDir: values.uploads,
      overwrite: values.overwrite,
      log: values.verbose ? (m) => console.log(m) : undefined,
    });
    const md = reportMarkdown(report, await artworksMissingEnglish(db));
    await writeFile(values.report!, md);
    console.log("[import] done", JSON.stringify({ artworks: report.artworks, images: { ...report.images, missing: report.images.missing.length }, byStatus: report.byStatus }));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[import] failed", error);
  process.exit(1);
});
