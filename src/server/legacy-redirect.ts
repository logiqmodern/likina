import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { artworks } from "@/db/schema";
import { href, type Lang } from "@/i18n";

/** /product/<old WooCommerce slug> → the artwork's new page (308), else the shop (§11). */
export async function redirectLegacyProduct(request: Request, slug: string, lang: Lang): Promise<Response> {
  const legacy = decodeURIComponent(slug).normalize("NFC");
  let target: string = href.page(lang, "gallery");
  try {
    const [a] = await getDb().select({ slug: artworks.slug, slugEn: artworks.slugEn }).from(artworks).where(eq(artworks.legacySlug, legacy)).limit(1);
    if (a) target = href.artwork(lang, lang === "bg" ? a.slug : a.slugEn);
  } catch (error) {
    console.warn("[legacy] product lookup failed", (error as Error).message);
  }
  return NextResponse.redirect(new URL(target, request.url), 308);
}
