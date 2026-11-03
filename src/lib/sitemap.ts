/*
 * Pages listed in /sitemap.xml (§11). Only indexable public pages: no admin,
 * no checkout or order pages. Artworks, categories and artists are added from
 * the catalog in Phase 4. Pure.
 */

export const SITEMAP_PATHS = ["/", "/en"] as const;

export function sitemapPaths(): string[] {
  return [...SITEMAP_PATHS];
}
