import { CATEGORY_SLUGS, href, LANGS, type Lang, type StaticPage } from "@/i18n";

/*
 * Pages listed in /sitemap.xml (§11): every indexable public page in BG with
 * its EN alternate (hreflang). No admin, cart, checkout or order pages. Pure.
 */

export interface SitemapEntry {
  bg: string;
  en: string;
  lastModified?: Date;
  priority: number;
}

const PAGES: StaticPage[] = ["home", "gallery", "customIcon", "about", "contact", "faq", "shipping", "terms", "privacy", "cookies"];

export function sitemapEntries(catalog: {
  artworks: Array<{ slug: string; slugEn: string; status: string; publishedAt: Date | null }>;
  artists: Array<{ slug: string; slugEn: string }>;
}): SitemapEntry[] {
  const both = (f: (l: Lang) => string) => Object.fromEntries(LANGS.map((l) => [l, f(l)])) as { bg: string; en: string };
  return [
    ...PAGES.map((p) => ({ ...both((l) => href.page(l, p)), priority: p === "home" ? 1 : p === "gallery" ? 0.9 : 0.5 })),
    ...CATEGORY_SLUGS.map((c) => ({ ...both((l) => href.category(l, c.bg)), priority: 0.8 })),
    ...catalog.artists.map((a) => ({ bg: href.artist("bg", a.slug), en: href.artist("en", a.slugEn), priority: 0.6 })),
    ...catalog.artworks.map((a) => ({
      bg: href.artwork("bg", a.slug),
      en: href.artwork("en", a.slugEn),
      lastModified: a.publishedAt ?? undefined,
      priority: a.status === "available" ? 0.7 : 0.3,
    })),
  ];
}
