/**
 * Fills missing translations with the Claude API (§7): artworks, their photo
 * alt texts and artist bios BG → EN (+ EN slug), reviews EN → BG.
 * Runs on every Vercel build; without ANTHROPIC_API_KEY it does nothing.
 * Never fails the build: errors are logged and retried on the next run.
 *
 *   npx tsx scripts/translate-missing.ts [--limit 150]
 */
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { and, eq, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { slugify, uniqueSlug } from "../src/lib/slug";
import { translateFields } from "../src/server/translate";

const { artists, artworkImages, artworks, reviews } = schema;
const hash = (s: string | null) => createHash("sha256").update(s ?? "").digest("hex").slice(0, 16);

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    console.log("[translate] ANTHROPIC_API_KEY is not set — skipped");
    return;
  }
  const { values } = parseArgs({ options: { limit: { type: "string", default: "150" } } });
  const limit = Number(values.limit);
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url, max: 2 });
  const db = drizzle({ client: pool, schema });
  const opts = { apiKey, model: process.env.ANTHROPIC_MODEL?.trim() || undefined };
  let done = 0;
  let failed = 0;

  try {
    const taken = new Set((await db.select({ s: artworks.slug, e: artworks.slugEn }).from(artworks)).flatMap((r) => [r.s, r.e]));
    const todo = await db.select().from(artworks).where(isNull(artworks.titleEn)).limit(limit);
    for (const a of todo) {
      const imgs = await db.select({ id: artworkImages.id, altBg: artworkImages.altBg }).from(artworkImages).where(and(eq(artworkImages.artworkId, a.id), isNull(artworkImages.altEn)));
      const out = await translateFields(
        {
          title: a.titleBg,
          technique: a.techniqueBg,
          materials: a.materialsBg,
          description: a.descriptionBg,
          story: a.storyBg,
          ...Object.fromEntries(imgs.map((i, n) => [`alt_${n}`, i.altBg])),
        },
        "bg>en",
        opts,
      ).catch((e: Error) => (console.warn(`[translate] ${a.titleBg}: ${e.message}`), null));
      if (!out?.title) {
        failed++;
        continue;
      }
      taken.delete(a.slugEn);
      const slugEn = uniqueSlug(slugify(out.title) || a.slug, taken);
      taken.add(slugEn);
      const meta = Object.fromEntries(
        (["title", "technique", "materials", "description", "story"] as const)
          .filter((f) => out[f])
          .map((f) => [f, { sourceHash: hash(a[`${f}Bg` as "titleBg"]), locked: false }]),
      );
      await db
        .update(artworks)
        .set({
          titleEn: out.title,
          techniqueEn: out.technique ?? null,
          materialsEn: out.materials ?? null,
          descriptionEn: out.description ?? null,
          storyEn: out.story ?? null,
          slugEn,
          translationMeta: { ...a.translationMeta, ...meta },
        })
        .where(eq(artworks.id, a.id));
      for (const [n, i] of imgs.entries()) if (out[`alt_${n}`]) await db.update(artworkImages).set({ altEn: out[`alt_${n}`] }).where(eq(artworkImages.id, i.id));
      done++;
    }

    for (const a of await db.select().from(artists).where(and(isNull(artists.bioEn), sql`${artists.bioBg} IS NOT NULL`))) {
      const out = await translateFields({ bio: a.bioBg }, "bg>en", opts).catch(() => null);
      if (out?.bio) {
        await db.update(artists).set({ bioEn: out.bio }).where(eq(artists.id, a.id));
        done++;
      } else failed++;
    }

    for (const r of await db.select().from(reviews).where(and(isNull(reviews.textBg), sql`${reviews.textEn} IS NOT NULL`))) {
      const out = await translateFields({ text: r.textEn }, "en>bg", opts).catch(() => null);
      if (out?.text) {
        await db.update(reviews).set({ textBg: out.text }).where(eq(reviews.id, r.id));
        done++;
      } else failed++;
    }
  } finally {
    await pool.end();
  }
  console.log(`[translate] done: ${done} translated, ${failed} failed (retried next run)`);
}

main().catch((error) => {
  console.error("[translate] failed (the build continues)", error);
});
