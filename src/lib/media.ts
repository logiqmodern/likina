import { inArray } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/db/client";
import { media } from "@/db/schema";
import { CACHE_TAGS } from "./cache-tags";

/*
 * Public read of media metadata (alt text and intrinsic size) for images the
 * CMS content points to. Cached like the content snapshot (tag "content") so
 * it is part of the static shell; the bytes are served by /media/[id].
 */

export interface MediaInfo {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Public URL of a media item (next/image source). */
export function mediaSrc(id: string): string {
  return `/media/${id}`;
}

async function loadMediaInfo(ids: string[]): Promise<MediaInfo[]> {
  "use cache";
  cacheTag(CACHE_TAGS.content);
  cacheLife({ stale: 300, revalidate: 900, expire: 60 * 60 * 24 * 30 });
  try {
    const rows = await getDb()
      .select({ id: media.id, alt: media.alt, width: media.width, height: media.height })
      .from(media)
      .where(inArray(media.id, ids));
    return rows.map((r) => ({ ...r, src: mediaSrc(r.id) }));
  } catch (error) {
    console.warn("[media] database not reachable:", (error as Error).message);
    return [];
  }
}

/**
 * Metadata for the given media ids, keyed by id. Unknown or deleted ids are
 * missing from the result — callers then keep their placeholder.
 */
export async function getMediaInfo(ids: ReadonlyArray<string | null | undefined>): Promise<Map<string, MediaInfo>> {
  const clean = [...new Set(ids.filter((id): id is string => !!id && UUID.test(id)))].sort();
  if (clean.length === 0) return new Map();
  const rows = await loadMediaInfo(clean);
  return new Map(rows.map((r) => [r.id, r]));
}

/** One media item, or null. */
export async function getMediaItem(id: string | null | undefined): Promise<MediaInfo | null> {
  if (!id) return null;
  return (await getMediaInfo([id])).get(id) ?? null;
}
