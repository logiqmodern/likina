/**
 * Shrinks a photo in the browser before upload (phone photos are 3–8 MB):
 * longest side ≤ 2400 px, JPEG 0.9, metadata dropped by the canvas. Keeps the
 * request under the server-action body limit (next.config.ts) and the 4.5 MB
 * limit of serverless hosts. The server re-encodes to WebP anyway.
 * Returns the original file when the browser cannot decode it (e.g. HEIC in
 * Chrome) or when it is already small.
 */
export const UPLOAD_BODY_LIMIT = 4 * 1024 * 1024;
const MAX_EDGE = 2400;

export async function downscaleForUpload(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function" || file.type === "image/gif") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= 1.5 * 1024 * 1024) return file;
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}
