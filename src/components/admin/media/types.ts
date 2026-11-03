/** An image of the media library as the admin forms see it. */
export interface MediaOption {
  id: string;
  alt: string;
  width: number;
  height: number;
  filename: string;
}

/** Largest file the picker accepts; photos are shrunk in the browser before upload (downscale.ts). */
export const MAX_UPLOAD_MB = 40;
/** The server checks again after the browser has shrunk the photo (MAX_UPLOAD_BYTES in src/server/media.ts). */
export const MAX_UPLOAD_BYTES_CLIENT = MAX_UPLOAD_MB * 1024 * 1024;

export function mediaSrc(id: string): string {
  return `/media/${id}`;
}

/** "1,2 MB" / "640 KB" */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
