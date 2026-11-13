import { describe, expect, it } from "vitest";
import { NOINDEX_PATHS } from "./indexing";
import { sitemapEntries } from "./sitemap";

describe("sitemapEntries", () => {
  const entries = sitemapEntries({
    artworks: [{ slug: "sv-nikolay", slugEn: "st-nicholas", status: "available", publishedAt: new Date("2026-03-01") }],
    artists: [{ slug: "gergana-nikiforova", slugEn: "gergana-nikiforova" }],
  });

  it("lists pages, categories, artists and artworks with their EN alternates", () => {
    expect(entries).toContainEqual(expect.objectContaining({ bg: "/", en: "/en", priority: 1 }));
    expect(entries).toContainEqual(expect.objectContaining({ bg: "/ikoni", en: "/en/icons" }));
    expect(entries).toContainEqual(expect.objectContaining({ bg: "/tvorba/sv-nikolay", en: "/en/artwork/st-nicholas" }));
    expect(entries).toContainEqual(expect.objectContaining({ bg: "/avtori/gergana-nikiforova" }));
  });

  it("never lists private pages", () => {
    for (const e of entries) for (const p of NOINDEX_PATHS) expect(e.bg.startsWith(p) || e.en.startsWith(p)).toBe(false);
  });
});
