import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { connection } from "next/server";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { serverEnv } from "@/lib/env";

/**
 * POST /api/cron/revalidate — called by deploy/remote-up.sh right after a
 * deploy. The Docker image is built without the database, so its prerendered
 * pages carry the code defaults (no CMS photos, default texts, default prices).
 * This drops every cached entry at once (`expire: 0`: the next request renders
 * fresh, nothing stale is served). OPEN-QUESTIONS F6. Requires
 * `Authorization: Bearer <CRON_SECRET>`; refuses without CRON_SECRET.
 */
function authorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  await connection();
  if (!authorized(request.headers.get("authorization"), serverEnv().CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const tags = Object.values(CACHE_TAGS);
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
  return Response.json({ revalidated: tags }, { headers: { "Cache-Control": "no-store" } });
}
