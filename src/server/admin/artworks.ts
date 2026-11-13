import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { artists, artworkImages, artworks, artworkStatus } from "@/db/schema";

/* §10.2.2: the artworks list in the admin (editing comes with Phase 7). */

export type ArtworkStatusName = (typeof artworkStatus.enumValues)[number];

export const ARTWORK_STATUS_LABELS: Record<ArtworkStatusName, string> = {
  available: "Налична",
  reserved: "Резервирана",
  sold: "Продадена",
  draft: "Чернова",
  hidden: "Скрита",
};

export async function listArtworks(db: Database, q: { status?: ArtworkStatusName; limit?: number; offset?: number } = {}) {
  const where = q.status ? eq(artworks.status, q.status) : undefined;
  const cover = db
    .select({ artworkId: artworkImages.artworkId, mediaId: sql<string>`(array_agg(${artworkImages.mediaId} ORDER BY ${artworkImages.sortOrder}))[1]`.as("media_id") })
    .from(artworkImages)
    .groupBy(artworkImages.artworkId)
    .as("cover");
  const [items, [total], byStatus] = await Promise.all([
    db
      .select({
        id: artworks.id,
        titleBg: artworks.titleBg,
        status: artworks.status,
        kind: artworks.kind,
        priceCents: artworks.priceCents,
        widthMm: artworks.widthMm,
        heightMm: artworks.heightMm,
        depthMm: artworks.depthMm,
        sizeNeedsCheck: artworks.sizeNeedsCheck,
        hasEnglish: sql<boolean>`${artworks.titleEn} IS NOT NULL`,
        artistName: artists.nameBg,
        coverMediaId: cover.mediaId,
      })
      .from(artworks)
      .leftJoin(artists, eq(artists.id, artworks.artistId))
      .leftJoin(cover, eq(cover.artworkId, artworks.id))
      .where(where)
      .orderBy(desc(artworks.publishedAt), asc(artworks.titleBg))
      .limit(Math.min(q.limit ?? 60, 200))
      .offset(q.offset ?? 0),
    db.select({ n: count() }).from(artworks).where(and(where)),
    db.select({ status: artworks.status, n: count() }).from(artworks).groupBy(artworks.status),
  ]);
  const counts = Object.fromEntries(artworkStatus.enumValues.map((s) => [s, 0])) as Record<ArtworkStatusName, number>;
  for (const r of byStatus) counts[r.status] = r.n;
  return { items, total: total?.n ?? 0, counts };
}
