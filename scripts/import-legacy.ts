/**
 * Imports the old likina.com catalogue (spec §15.2).
 *
 *   npx tsx scripts/import-legacy.ts [--uploads data/legacy/images] [--catalog data/legacy/catalog.json] [--overwrite] [--if-empty] [--report docs/IMPORT-REPORT.md]
 *
 * --uploads: data/legacy/images (optimized <attachment id>.webp, the default) or a wp-content/uploads folder.
 * --if-empty: do nothing once the catalogue has been imported (runs on every Vercel build).
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
      uploads: { type: "string", default: "data/legacy/images" },
      "if-empty": { type: "boolean", default: false },
      catalog: { type: "string", default: "data/legacy/catalog.json" },
      report: { type: "string", default: "docs/IMPORT-REPORT.md" },
      overwrite: { type: "boolean", default: false },
      verbose: { type: "boolean", default: false },
    },
  });
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const catalog = JSON.parse(await readFile(values.catalog!, "utf8")) as LegacyCatalog;
  const pool = new Pool({ connectionString: url, max: 2 });
  try {
    const db = drizzle({ client: pool, schema });
    if (values["if-empty"]) {
      const { rows } = await pool.query("SELECT 1 FROM artworks WHERE legacy_wp_id IS NOT NULL LIMIT 1");
      if (rows.length) {
        console.log("[import] catalogue already imported — skipped");
        return;
      }
    }
    const report = await importLegacyCatalog(db, catalog, {
      uploadsDir: values.uploads!,
      overwrite: values.overwrite,
      log: values.verbose ? (m) => console.log(m) : undefined,
    });
    if (!values["if-empty"]) await writeFile(values.report!, reportMarkdown(report, await artworksMissingEnglish(db)));
    console.log("[import] done", JSON.stringify({ artworks: report.artworks, images: { ...report.images, missing: report.images.missing.length }, byStatus: report.byStatus }));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[import] failed", error);
  process.exit(1);
});
