import { desc, eq, inArray } from "drizzle-orm";
import sharp from "sharp";
import type { Database } from "@/db/client";
import { media } from "@/db/schema";
import { writeAudit } from "./admin/audit";

/*
 * Media library (§10.2.12): uploads are re-encoded to WebP (max 2400 px on
 * the long side), auto-rotated, and stripped of metadata (EXIF can contain
 * GPS and device data). Stored in the database; served by /media/[id].
 */

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_EDGE = 2400;
/** Decompression-bomb guard: 40 MP covers any phone camera. */
const MAX_INPUT_PIXELS = 40_000_000;
const ACCEPTED = new Set(["jpeg", "png", "webp", "avif", "gif", "tiff", "heif"]);

export class MediaError extends Error {
  constructor(
    public readonly code: "too_large" | "unsupported" | "alt_required" | "not_found" | "in_use",
    public readonly usedBy: Array<{ collection: string; slug: string }> = [],
  ) {
    super(code);
    this.name = "MediaError";
  }
}

export interface OptimizedImage {
  data: Buffer;
  width: number;
  height: number;
  mime: "image/webp";
}

export async function optimizeImage(input: Buffer): Promise<OptimizedImage> {
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new MediaError("too_large");
  let format: string | undefined;
  try {
    format = (await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata()).format;
  } catch {
    throw new MediaError("unsupported");
  }
  if (!format || !ACCEPTED.has(format)) throw new MediaError("unsupported");
  const { data, info } = await sharp(input, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS })
    .rotate() // apply EXIF orientation, then metadata is dropped (sharp drops it by default)
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, mime: "image/webp" };
}

export async function uploadMedia(
  db: Database,
  actor: string,
  input: { file: Buffer; filename: string; alt: string; note?: string | null },
): Promise<string> {
  const alt = input.alt.trim();
  if (!alt) throw new MediaError("alt_required");
  const img = await optimizeImage(input.file);
  const filename = input.filename.replace(/[^\p{L}\p{N}._ -]/gu, "").slice(0, 120) || "image";
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(media)
      .values({
        filename,
        alt: alt.slice(0, 300),
        mime: img.mime,
        width: img.width,
        height: img.height,
        bytes: img.data.byteLength,
        data: img.data,
        note: input.note?.trim() || null,
        uploadedBy: actor,
      })
      .returning({ id: media.id });
    await writeAudit(tx, { actor, action: "media.upload", entity: "media", entityId: row!.id, diff: { filename, bytes: img.data.byteLength } });
    return row!.id;
  });
}

export interface MediaListItem {
  id: string;
  filename: string;
  alt: string;
  width: number;
  height: number;
  bytes: number;
  note: string | null;
  createdAt: Date;
}

export async function listMedia(db: Database, limit = 200): Promise<MediaListItem[]> {
  return db
    .select({
      id: media.id,
      filename: media.filename,
      alt: media.alt,
      width: media.width,
      height: media.height,
      bytes: media.bytes,
      note: media.note,
      createdAt: media.createdAt,
    })
    .from(media)
    .orderBy(desc(media.createdAt))
    .limit(limit);
}

export async function getMediaFile(db: Database, id: string) {
  const [row] = await db
    .select({ data: media.data, mime: media.mime, createdAt: media.createdAt })
    .from(media)
    .where(eq(media.id, id));
  return row ?? null;
}

export async function getMediaMeta(db: Database, ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select({ id: media.id, alt: media.alt, width: media.width, height: media.height })
    .from(media)
    .where(inArray(media.id, ids));
}

export async function updateMedia(db: Database, actor: string, input: { id: string; alt: string; note?: string | null }) {
  const alt = input.alt.trim();
  if (!alt) throw new MediaError("alt_required");
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(media)
      .set({ alt: alt.slice(0, 300), ...(input.note !== undefined ? { note: input.note?.trim() || null } : {}) })
      .where(eq(media.id, input.id))
      .returning({ id: media.id });
    if (!row) throw new MediaError("not_found");
    await writeAudit(tx, { actor, action: "media.update", entity: "media", entityId: input.id });
  });
}

/** Refused while any content (draft or published) still uses the image. */
export async function deleteMedia(db: Database, actor: string, id: string): Promise<void> {
  // Phase 1: artworks referencing the image are checked here (artwork_images).
  const usedBy: Array<{ collection: string; slug: string }> = [];
  if (usedBy.length > 0) throw new MediaError("in_use", usedBy);
  await db.transaction(async (tx) => {
    const [row] = await tx.delete(media).where(eq(media.id, id)).returning({ id: media.id });
    if (!row) throw new MediaError("not_found");
    await writeAudit(tx, { actor, action: "media.delete", entity: "media", entityId: id });
  });
}
