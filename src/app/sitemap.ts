import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/components/site/seo";
import { sitemapEntries } from "@/lib/sitemap";
import { listArtists, listPublicArtworks } from "@/server/catalog";

/** /sitemap.xml (§11): BG URLs with the EN alternates (hreflang). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [artworks, artists] = await Promise.all([listPublicArtworks(), listArtists()]);
  return sitemapEntries({ artworks, artists }).flatMap((e) => {
    const languages = { bg: absoluteUrl(e.bg), en: absoluteUrl(e.en), "x-default": absoluteUrl(e.bg) };
    return [
      { url: absoluteUrl(e.bg), lastModified: e.lastModified, priority: e.priority, alternates: { languages } },
      { url: absoluteUrl(e.en), lastModified: e.lastModified, priority: e.priority, alternates: { languages } },
    ];
  });
}
