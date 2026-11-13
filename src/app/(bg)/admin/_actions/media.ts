"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { type ActionResult, formOptional, formString, MANAGER_ROLES, runAdminAction } from "@/server/admin/action-result";
import { deleteMedia, getMediaMeta, MAX_UPLOAD_BYTES, MediaError, updateMedia, uploadMedia } from "@/server/media";

/*
 * Media library (§10.2.12) — owner and developer only. Images are
 * re-encoded on the server (WebP, max 2400 px, metadata removed); the alt
 * text is required. Uploads arrive as FormData, one image per request.
 * NOTE: the default Server Action body limit is 1 MB — see the report for
 * the next.config change (serverActions.bodySizeLimit, proxyClientMaxBodySize).
 */

const ROLES = { roles: MANAGER_ROLES };
const uuid = z.uuid();

export interface UploadedMedia {
  id: string;
  alt: string;
  width: number;
  height: number;
  filename: string;
}

function mediaChanged() {
  updateTag(CACHE_TAGS.content);
  refresh();
}

/** Uploads one image (fields: file, alt, note). */
export async function uploadMediaAction(_prev: ActionResult<UploadedMedia> | null, fd: FormData): Promise<ActionResult<UploadedMedia>> {
  return runAdminAction<UploadedMedia>(ROLES, async ({ db, actor }) => {
    const file = fd.get("file");
    const alt = formString(fd, "alt");
    const note = formOptional(fd, "note");
    const errors: Record<string, string> = {};
    if (!(file instanceof File) || file.size === 0) errors.file = "Избери снимка.";
    else if (file.size > MAX_UPLOAD_BYTES) errors.file = "Файлът е твърде голям (до 15 MB).";
    else if (file.type && !file.type.startsWith("image/")) errors.file = "Това не е снимка. Качи JPG, PNG или WebP.";
    if (!alt) errors.alt = "Опиши какво има на снимката — задължително е.";
    else if (alt.length > 300) errors.alt = "До 300 знака.";
    if (note && note.length > 300) errors.note = "До 300 знака.";
    if (Object.keys(errors).length > 0 || !(file instanceof File)) {
      return { ok: false, message: "Провери маркираните полета.", fieldErrors: errors };
    }
    // The size is checked above, before the bytes are copied into memory again.
    const buffer = Buffer.from(await file.arrayBuffer());
    const id = await uploadMedia(db, actor, { file: buffer, filename: file.name, alt, note });
    const [meta] = await getMediaMeta(db, [id]);
    mediaChanged();
    return {
      ok: true,
      data: { id, alt, width: meta?.width ?? 0, height: meta?.height ?? 0, filename: file.name },
      message: "Снимката е качена.",
    };
  });
}

/** Edits the alt text and the note of an image (fields: id, alt, note). */
export async function updateMediaAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAdminAction<null>(ROLES, async ({ db, actor }) => {
    const id = formString(fd, "id");
    if (!uuid.safeParse(id).success) return { ok: false, message: "Изображението не е намерено." };
    const alt = formString(fd, "alt");
    const note = formOptional(fd, "note");
    const errors: Record<string, string> = {};
    if (!alt) errors.alt = "Описанието е задължително.";
    else if (alt.length > 300) errors.alt = "До 300 знака.";
    if (note && note.length > 300) errors.note = "До 300 знака.";
    if (Object.keys(errors).length > 0) return { ok: false, message: "Провери маркираните полета.", fieldErrors: errors };
    await updateMedia(db, actor, { id, alt, note });
    mediaChanged();
    return { ok: true, data: null, message: "Запазено." };
  });
}

/** Deletes an image that no content (draft or published) uses. */
export async function deleteMediaAction(id: string): Promise<ActionResult> {
  return runAdminAction<null>(ROLES, async ({ db, actor }) => {
    if (!uuid.safeParse(id).success) return { ok: false, message: "Изображението не е намерено." };
    try {
      await deleteMedia(db, actor, id);
    } catch (error) {
      if (error instanceof MediaError && error.code === "in_use") {
        const where = error.usedBy.map((u) => `${u.collection}: ${u.slug}`).join("; ");
        return { ok: false, message: `Снимката се използва и не може да се изтрие. Махни я първо от: ${where}.` };
      }
      throw error;
    }
    mediaChanged();
    return { ok: true, data: null, message: "Снимката е изтрита." };
  });
}
