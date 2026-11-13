import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { artists, artworkCategories, artworkImages, artworks, categories, media, priceHistory, reviews } from "@/db/schema";
import { suggestSize } from "@/domain/artwork-size";
import sharp from "sharp";
import { slugify, uniqueSlug } from "@/lib/slug";
import { optimizeImage } from "@/server/media";
import { cleanLegacyText, combineLegacyTexts, toLines } from "./legacy-text";

/*
 * Import of the old likina.com catalogue (spec §15.2) from data/legacy/catalog.json
 * (extracted from the cPanel backup by scripts/legacy/extract-dump.py) and the
 * original image files.
 *
 * Idempotent: artworks are matched by legacy_wp_id, images by WordPress
 * attachment id, artists/categories by slug. Existing rows are not
 * overwritten (the admin may have edited them) unless `overwrite` is set.
 */

export interface LegacyImage {
  id: number;
  file: string;
  alt: string;
  title: string;
}

export interface LegacyProduct {
  wpId: number;
  status: "publish" | "draft";
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  dateGmt: string | null;
  priceCents: number | null;
  regularCents: number | null;
  saleCents: number | null;
  stockStatus: string | null;
  categories: string[];
  images: LegacyImage[];
}

export interface LegacyCatalog {
  products: LegacyProduct[];
  categories: Array<{ wpId: number; name: string; slug: string; description: string; image: LegacyImage | null }>;
  reviews: Array<{ name: string; text: string }>;
  aboutHtml: string;
}

/** The two artists (spec §20: only these two). English names are their own Latin spelling. */
const ARTISTS = [
  { slug: "gergana-nikiforova", slugEn: "gergana-nikiforova", nameBg: "Гергана Никифорова", nameEn: "Gergana Nikiforova", legacySlug: "gergana-nikiforova", sortOrder: 0 },
  { slug: "rumen-bozhinov", slugEn: "rumen-bozhinov", nameBg: "Румен Божинов", nameEn: "Rumen Bozhinov", legacySlug: "rumen-bozhinov", sortOrder: 1 },
] as const;

/** The four categories of the new site (spec §4) and the old WooCommerce categories that map to them. */
const CATEGORIES = [
  { slug: "ikoni", slugEn: "icons", nameBg: "Икони", nameEn: "Icons", legacy: ["hand-painted-icons", "available-icons", "custom-icons"], imageFrom: "hand-painted-icons" },
  { slug: "kartini-sas-zlato", slugEn: "gold-paintings", nameBg: "Картини със злато", nameEn: "Gold paintings", legacy: ["gold-paintings-landscapes-stilllife"], imageFrom: "gold-paintings-landscapes-stilllife" },
  { slug: "abstraktni-kartini", slugEn: "abstract-paintings", nameBg: "Абстрактни картини", nameEn: "Abstract paintings", legacy: ["abstract-paintings"], imageFrom: "abstract-paintings" },
  { slug: "art-printove", slugEn: "art-prints", nameBg: "Арт принтове", nameEn: "Art prints", legacy: ["premium-art-prints", "framed-art-prints", "art-prints"], imageFrom: "premium-art-prints" },
] as const;

const PRINT_CATS = new Set(["premium-art-prints", "framed-art-prints", "art-prints"]);

export interface ImportOptions {
  /** directory the attachment paths ("2026/03/x.jpg") are relative to (wp-content/uploads) */
  uploadsDir: string;
  overwrite?: boolean;
  actor?: string;
  log?: (msg: string) => void;
}

export interface ImportReport {
  artworks: { created: number; updated: number; skipped: number };
  images: { created: number; reused: number; missing: string[] };
  byStatus: Record<string, number>;
  byKind: Record<string, number>;
  noPrice: string[];
  noImages: string[];
  drafts: string[];
  sizesToCheck: number;
  sizeUnparsed: Array<{ title: string; lines: string[] }>;
  certificateRemoved: number;
  artistMismatch: Array<{ title: string; mentioned: string[]; assigned: string | null }>;
  reviews: number;
}

function artistSlugOf(cats: string[]): string | null {
  return ARTISTS.find((a) => cats.includes(a.legacySlug))?.slug ?? null;
}

function kindOf(cats: string[]): "original" | "print" | "custom_sample" {
  if (cats.includes("custom-icons")) return "custom_sample";
  if (cats.some((c) => PRINT_CATS.has(c))) return "print";
  return "original";
}

/** available / sold / draft / hidden from the WooCommerce state. */
export function statusOf(p: Pick<LegacyProduct, "status" | "stockStatus" | "priceCents">, kind: string): "draft" | "available" | "sold" | "hidden" {
  if (p.status === "draft") return "draft";
  if (kind === "custom_sample") return "hidden";
  if (p.stockStatus === "outofstock") return "sold";
  return p.priceCents && p.priceCents > 0 ? "available" : "hidden";
}

/** A WordPress alt/title is usable as alt text if it is not a file name. */
function usableAlt(s: string): string | null {
  const t = s.trim();
  if (!t || /^(il_fullxfull|img[_-]?\d|dsc|\d+(\.\d+)*$|а-\d{4}-)/i.test(t) || /\.(jpe?g|png|webp)$/i.test(t)) return null;
  return t;
}

/** Artist bios from the old About page: the text between the two artist headings. */
export function biosFromAbout(aboutHtml: string): Record<string, string> {
  const lines = toLines(aboutHtml);
  const idx = (name: string) => lines.findIndex((l) => l.startsWith("\u0001") && l.includes(name));
  const g = idx("Гергана Никифорова");
  const r = idx("Румен Божинов");
  const html = (from: number, to: number) => cleanLegacyText(lines.slice(from + 1, to).join("\n")).html;
  const out: Record<string, string> = {};
  if (g >= 0) out["gergana-nikiforova"] = html(g, r > g ? r : lines.length);
  if (r >= 0) out["rumen-bozhinov"] = html(r, g > r ? g : lines.length);
  return out;
}

export async function importLegacyCatalog(db: Database, catalog: LegacyCatalog, opts: ImportOptions): Promise<ImportReport> {
  const log = opts.log ?? (() => {});
  const actor = opts.actor ?? "import";
  const report: ImportReport = {
    artworks: { created: 0, updated: 0, skipped: 0 },
    images: { created: 0, reused: 0, missing: [] },
    byStatus: {},
    byKind: {},
    noPrice: [],
    noImages: [],
    drafts: [],
    sizesToCheck: 0,
    sizeUnparsed: [],
    certificateRemoved: 0,
    artistMismatch: [],
    reviews: 0,
  };

  // ── media (shared by artworks, categories, artists) ──
  const mediaCache = new Map<number, string>();
  async function mediaFor(img: LegacyImage, alt: string): Promise<string | null> {
    const cached = mediaCache.get(img.id);
    if (cached) return cached;
    const filename = `wp-${img.id}-${path.basename(img.file)}`;
    const [existing] = await db.select({ id: media.id }).from(media).where(eq(media.filename, filename)).limit(1);
    if (existing) {
      report.images.reused++;
      mediaCache.set(img.id, existing.id);
      return existing.id;
    }
    let optimized: { data: Buffer; mime: string; width: number; height: number };
    try {
      // data/legacy/images/<id>.webp is already optimized (committed for the Vercel build); else the original upload
      const webp = await readFile(path.join(opts.uploadsDir, `${img.id}.webp`)).catch(() => null);
      if (webp) {
        const meta = await sharp(webp).metadata();
        optimized = { data: webp, mime: "image/webp", width: meta.width ?? 0, height: meta.height ?? 0 };
      } else optimized = await optimizeImage(await readFile(path.join(opts.uploadsDir, img.file)));
    } catch {
      report.images.missing.push(img.file);
      return null;
    }
    const [row] = await db
      .insert(media)
      .values({
        filename,
        alt,
        mime: optimized.mime,
        width: optimized.width,
        height: optimized.height,
        bytes: optimized.data.byteLength,
        data: optimized.data,
        note: `likina.com WordPress attachment ${img.id}`,
        uploadedBy: actor,
      })
      .returning({ id: media.id });
    report.images.created++;
    mediaCache.set(img.id, row!.id);
    return row!.id;
  }

  // ── artists ──
  const bios = biosFromAbout(catalog.aboutHtml);
  const legacyCat = new Map(catalog.categories.map((c) => [c.slug, c]));
  const artistId = new Map<string, string>();
  for (const a of ARTISTS) {
    const photo = legacyCat.get(a.legacySlug)?.image;
    const photoMediaId = photo ? await mediaFor(photo, a.nameBg) : null;
    await db
      .insert(artists)
      .values({ ...a, bioBg: bios[a.slug] ?? null, photoMediaId })
      .onConflictDoNothing({ target: artists.slug });
    const [row] = await db.select({ id: artists.id }).from(artists).where(eq(artists.slug, a.slug));
    artistId.set(a.slug, row!.id);
  }

  // ── categories ──
  const categoryIdByLegacy = new Map<string, string>();
  for (const [i, c] of CATEGORIES.entries()) {
    const legacy = legacyCat.get(c.imageFrom);
    const imageMediaId = legacy?.image ? await mediaFor(legacy.image, c.nameBg) : null;
    await db
      .insert(categories)
      .values({
        slug: c.slug,
        slugEn: c.slugEn,
        nameBg: c.nameBg,
        nameEn: c.nameEn,
        descriptionBg: legacy?.description?.trim() || null,
        imageMediaId,
        sortOrder: i,
        legacySlugs: [...c.legacy],
      })
      .onConflictDoNothing({ target: categories.slug });
    const [row] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, c.slug));
    for (const l of c.legacy) categoryIdByLegacy.set(l, row!.id);
  }

  // ── artworks ──
  const takenSlugs = new Set(
    (await db.select({ slug: artworks.slug, slugEn: artworks.slugEn }).from(artworks)).flatMap((r) => [r.slug, r.slugEn]),
  );

  for (const p of catalog.products) {
    const kind = kindOf(p.categories);
    const artistSlug = artistSlugOf(p.categories);
    const status = statusOf(p, kind);
    const text = combineLegacyTexts(p.excerpt, p.content);
    const size = suggestSize(text.sizeLines.join("\n"));
    const priceCents = p.priceCents && p.priceCents > 0 ? p.priceCents : null;
    const compareAtCents = p.saleCents && p.regularCents && p.regularCents > p.saleCents ? p.regularCents : null;

    report.byStatus[status] = (report.byStatus[status] ?? 0) + 1;
    report.byKind[kind] = (report.byKind[kind] ?? 0) + 1;
    if (priceCents === null && status !== "sold") report.noPrice.push(p.title);
    if (p.images.length === 0) report.noImages.push(p.title);
    if (status === "draft") report.drafts.push(p.title);
    report.certificateRemoved += text.removedCertificate.length;
    if (text.sizeLines.length && !size) report.sizeUnparsed.push({ title: p.title, lines: text.sizeLines });
    if (size) report.sizesToCheck++;
    const artistName = ARTISTS.find((a) => a.slug === artistSlug)?.nameBg ?? null;
    const mismatched = text.artistMentions.filter(
      (m) => !artistName || !m.toLowerCase().replace(/\s+/g, " ").includes(artistName.toLowerCase()),
    );
    if (mismatched.length) report.artistMismatch.push({ title: p.title, mentioned: mismatched, assigned: artistName });

    const [existing] = await db.select({ id: artworks.id }).from(artworks).where(eq(artworks.legacyWpId, p.wpId));
    let id: string;
    const fields = {
      kind,
      status,
      titleBg: p.title,
      artistId: artistSlug ? artistId.get(artistSlug)! : null,
      techniqueBg: text.technique,
      materialsBg: text.materials,
      widthMm: size?.widthMm ?? null,
      heightMm: size?.heightMm ?? null,
      depthMm: size?.depthMm ?? null,
      framed: text.framed ?? size?.framed ?? null,
      sizeNeedsCheck: text.sizeLines.length > 0,
      sizeNote: text.sizeLines.length ? text.sizeLines.join("\n") : null,
      priceCents,
      compareAtCents,
      descriptionBg: text.html || null,
      // prints: edition size and stock are not known yet (OPEN-QUESTIONS Q4) — one copy until the client says otherwise
      stock: status === "sold" ? 0 : 1,
      legacySlug: p.slug || null,
      publishedAt: p.status === "publish" && p.dateGmt ? new Date(p.dateGmt) : null,
    };

    if (existing) {
      id = existing.id;
      if (opts.overwrite) {
        await db.update(artworks).set(fields).where(eq(artworks.id, id));
        report.artworks.updated++;
      } else report.artworks.skipped++;
    } else {
      const slug = uniqueSlug(slugify(p.title) || `tvorba-${p.wpId}`, takenSlugs);
      takenSlugs.add(slug);
      // the EN slug follows the EN title once it is translated (§7); until then the BG slug
      const [row] = await db
        .insert(artworks)
        .values({ ...fields, slug, slugEn: slug, legacyWpId: p.wpId })
        .returning({ id: artworks.id });
      id = row!.id;
      await db.insert(priceHistory).values({ artworkId: id, priceCents, compareAtCents, changedBy: actor });
      report.artworks.created++;
    }

    const catIds = [...new Set(p.categories.map((c) => categoryIdByLegacy.get(c)).filter((x): x is string => !!x))];
    if (catIds.length) {
      await db
        .insert(artworkCategories)
        .values(catIds.map((categoryId) => ({ artworkId: id, categoryId })))
        .onConflictDoNothing();
    }

    for (const [n, img] of p.images.entries()) {
      const alt = usableAlt(img.alt) ?? (artistName ? `${p.title} — ${artistName}` : p.title) + (n > 0 ? `, снимка ${n + 1}` : "");
      const mediaId = await mediaFor(img, alt);
      if (!mediaId) continue;
      await db
        .insert(artworkImages)
        .values({ artworkId: id, mediaId, sortOrder: n, altBg: alt, legacyWpId: img.id })
        .onConflictDoNothing({ target: [artworkImages.artworkId, artworkImages.mediaId] });
    }
    log(`${existing ? (opts.overwrite ? "updated" : "kept") : "created"} ${p.wpId} ${p.title}`);
  }

  // ── reviews (only when there are none yet) ──
  const [{ count }] = (await db.select({ count: sql<number>`count(*)::int` }).from(reviews)) as [{ count: number }];
  if (count === 0 && catalog.reviews.length) {
    await db.insert(reviews).values(
      catalog.reviews.map((r, i) => ({ textEn: r.text, textBg: null, authorName: r.name, sortOrder: i, isPublished: true })),
    );
    report.reviews = catalog.reviews.length;
  }

  return report;
}

/** Artworks still without English texts (for the translation step, §7). */
export async function artworksMissingEnglish(db: Database): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(artworks)
    .where(and(inArray(artworks.status, ["available", "sold", "reserved"]), sql`${artworks.titleEn} IS NULL`));
  return row?.n ?? 0;
}

/** Markdown report for docs/IMPORT-REPORT.md (BG — the client reads it). */
export function reportMarkdown(r: ImportReport, missingEnglish: number): string {
  const list = (items: string[]) => (items.length ? items.map((t) => `- ${t}`).join("\n") : "- няма");
  return `# Отчет от импорта на каталога (likina.com → нов сайт)

Източник: пълният архив от cPanel на Superhosting (база + снимки), 13.11.2026.

| | Брой |
|---|---|
| Творби — нови | ${r.artworks.created} |
| Творби — вече импортирани (без промяна) | ${r.artworks.skipped} |
| Творби — обновени | ${r.artworks.updated} |
| Снимки — качени | ${r.images.created} |
| Снимки — вече качени | ${r.images.reused} |
| Снимки — липсващ файл | ${r.images.missing.length} |
| Отзиви | ${r.reviews} |

**По статус:** ${Object.entries(r.byStatus).map(([k, v]) => `${k} ${v}`).join(" · ")}
**По вид:** ${Object.entries(r.byKind).map(([k, v]) => `${k} ${v}`).join(" · ")}

## За проверка от Гергана

### Размери (${r.sizesToCheck} творби)
Размерите са извадени от стария текст като **предложение** (Ш × В, при рамкирани — външният размер с рамката). Всяка творба има флаг „провери размерите“ и пази оригиналния ред от текста.

Без разчетен размер:
${r.sizeUnparsed.length ? r.sizeUnparsed.map((s) => `- ${s.title}: ${s.lines.join(" / ")}`).join("\n") : "- няма"}

### Без цена (не могат да се купят, докато не се въведе цена; продадените не са включени)
${list(r.noPrice)}

### Чернови (не са в сайта)
${list(r.drafts)}

### Без снимки
${list(r.noImages)}

### Автор в текста ≠ автор по категория
${r.artistMismatch.length ? r.artistMismatch.map((m) => `- ${m.title}: в текста „${m.mentioned.join(", ")}“, категория → ${m.assigned ?? "няма"}`).join("\n") : "- няма"}

## Какво е почистено автоматично
- „Сертификат за автентичност“ е махнат от описанията (${r.certificateRemoved} споменавания) — не се издава.
- Старите ✓ блокове (доставка 3–5 дни, връщане, контакти) са махнати: новият сайт ги показва на едно място, с актуалните условия.
- Арт принтовете са с наличност 1, докато не се уточни тиражът (OPEN-QUESTIONS Q4).

## Английски версии
${missingEnglish} публикувани творби са без английски текст. Те се превеждат автоматично с Claude API, когато ключът е добавен (ANTHROPIC_API_KEY във Vercel). Дотогава /en показва българския текст.
${r.images.missing.length ? `\n## Липсващи файлове\n${list(r.images.missing)}\n` : ""}`;
}
