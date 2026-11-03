/** Cache tags for `use cache` data; revalidated after admin changes. */
export const CACHE_TAGS = {
  /** artists, categories, artworks (Phase 1) */
  catalog: "catalog",
  /** settings: contacts, shop rules */
  settings: "settings",
  /** CMS content blocks */
  content: "content",
} as const;
