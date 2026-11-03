import { getDb } from "@/db/client";
import { getMediaFile } from "@/server/media";

/*
 * Public image delivery for the media library. Ids are random UUIDs; the
 * bytes never change for an id, but deletions must take effect within a day.
 * next/image fetches from here and serves resized variants.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const clean = id.replace(/\.webp$/, "");
  if (!UUID.test(clean)) return new Response("Not found", { status: 404 });
  const file = await getMediaFile(getDb(), clean);
  if (!file) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.data.byteLength),
      // One day, not "immutable": a deleted image (e.g. consent withdrawn) must stop being served.
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
