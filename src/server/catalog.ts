import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/db/client";
import { artists, artworkCategories, artworkImages, artworks, categories, media, reviews } from "@/db/schema";
import { CACHE_TAGS } from "@/lib/cache-tags";

/*
 * Public catalogue reads (cached, tag "catalog" — revalidated after admin edits).
 * The gallery has ~100 artworks, so the list is read once and filtered in memory.
 * Every reader survives a missing database (build without DB → empty site, not a crash).
 */

const LIFE = { stale: 300, revalidate: 900, expire: 60 * 60 * 24 * 7 } as const;
const PUBLIC_STATUSES = ["available", "reserved", "sold"] as const;

export interface CardArtwork {
  id: string;
  slug: string;
  slugEn: string;
  titleBg: string;
  titleEn: string | null;
  status: "available" | "reserved" | "sold";
  kind: "original" | "print" | "custom_sample";
  priceCents: number | null;
  compareAtCents: number | null;
  widthMm: number | null;
  heightMm: number | null;
  artistSlug: string | null;
  categorySlugs: string[];
  cover: { id: string; width: number; height: number; altBg: string; altEn: string | null } | null;
  publishedAt: Date | null;
}

async function safe<T>(what: string, fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.warn(`[catalog] ${what}: database not reachable:`, (error as Error).message);
    return fallback;
  }
}

/** All public artworks (available, reserved, sold), newest first. */
export async function listPublicArtworks(): Promise<CardArtwork[]> {
  "use cache";
  cacheTag(CACHE_TAGS.catalog);
  cacheLife(LIFE);
  return safe("artworks", [], async () => {
    const db = getDb();
    const rows = await db
      .select({
        id: artworks.id,
        slug: artworks.slug,
        slugEn: artworks.slugEn,
        titleBg: artworks.titleBg,
        titleEn: artworks.titleEn,
        status: artworks.status,
        kind: artworks.kind,
        priceCents: artworks.priceCents,
        compareAtCents: artworks.compareAtCents,
        widthMm: artworks.widthMm,
        heightMm: artworks.heightMm,
        artistSlug: artists.slug,
        publishedAt: artworks.publishedAt,
      })
      .from(artworks)
      .leftJoin(artists, eq(artists.id, artworks.artistId))
      .where(inArray(artworks.status, [...PUBLIC_STATUSES]))
      .orderBy(desc(artworks.publishedAt), asc(artworks.sortOrder), asc(artworks.titleBg));
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return [];
    const [cats, covers] = await Promise.all([
      db
        .select({ artworkId: artworkCategories.artworkId, slug: categories.slug })
        .from(artworkCategories)
        .innerJoin(categories, eq(categories.id, artworkCategories.categoryId))
        .where(inArray(artworkCategories.artworkId, ids)),
      db
        .select({
          artworkId: artworkImages.artworkId,
          id: artworkImages.mediaId,
          width: media.width,
          height: media.height,
          altBg: artworkImages.altBg,
          altEn: artworkImages.altEn,
          sortOrder: artworkImages.sortOrder,
        })
        .from(artworkImages)
        .innerJoin(media, eq(media.id, artworkImages.mediaId))
        .where(inArray(artworkImages.artworkId, ids))
        .orderBy(asc(artworkImages.sortOrder)),
    ]);
    const catsBy = new Map<string, string[]>();
    for (const c of cats) catsBy.set(c.artworkId, [...(catsBy.get(c.artworkId) ?? []), c.slug]);
    const coverBy = new Map<string, CardArtwork["cover"]>();
    for (const c of covers) if (!coverBy.has(c.artworkId)) coverBy.set(c.artworkId, { id: c.id, width: c.width, height: c.height, altBg: c.altBg, altEn: c.altEn });
    return rows.map((r) => ({
      ...r,
      status: r.status as CardArtwork["status"],
      categorySlugs: catsBy.get(r.id) ?? [],
      cover: coverBy.get(r.id) ?? null,
    }));
  });
}

/** One artwork with its texts and all photos (by BG or EN slug). */
export async function getArtwork(slug: string) {
  "use cache";
  cacheTag(CACHE_TAGS.catalog);
  cacheLife(LIFE);
  return safe("artwork", null, async () => {
    const db = getDb();
    const [a] = await db
      .select()
      .from(artworks)
      .where(and(inArray(artworks.status, [...PUBLIC_STATUSES]), eq(artworks.slug, slug)))
      .limit(1);
    const row = a ?? (await db.select().from(artworks).where(and(inArray(artworks.status, [...PUBLIC_STATUSES]), eq(artworks.slugEn, slug))).limit(1))[0];
    if (!row) return null;
    const images = await db
      .select({ id: artworkImages.mediaId, width: media.width, height: media.height, altBg: artworkImages.altBg, altEn: artworkImages.altEn })
      .from(artworkImages)
      .innerJoin(media, eq(media.id, artworkImages.mediaId))
      .where(eq(artworkImages.artworkId, row.id))
      .orderBy(asc(artworkImages.sortOrder));
    return { ...row, images };
  });
}

export async function listCategories() {
  "use cache";
  cacheTag(CACHE_TAGS.catalog);
  cacheLife(LIFE);
  return safe("categories", [], () =>
    getDb()
      .select({
        id: categories.id,
        slug: categories.slug,
        slugEn: categories.slugEn,
        nameBg: categories.nameBg,
        nameEn: categories.nameEn,
        descriptionBg: categories.descriptionBg,
        descriptionEn: categories.descriptionEn,
        imageMediaId: categories.imageMediaId,
      })
      .from(categories)
      .orderBy(asc(categories.sortOrder)),
  );
}

export async function listArtists() {
  "use cache";
  cacheTag(CACHE_TAGS.catalog);
  cacheLife(LIFE);
  return safe("artists", [], () =>
    getDb().select().from(artists).where(eq(artists.isActive, true)).orderBy(asc(artists.sortOrder)),
  );
}

export async function listReviews() {
  "use cache";
  cacheTag(CACHE_TAGS.catalog);
  cacheLife(LIFE);
  return safe("reviews", [], () =>
    getDb()
      .select({ id: reviews.id, textBg: reviews.textBg, textEn: reviews.textEn, authorName: reviews.authorName })
      .from(reviews)
      .where(and(eq(reviews.isPublished, true), isNotNull(reviews.authorName)))
      .orderBy(asc(reviews.sortOrder)),
  );
}
