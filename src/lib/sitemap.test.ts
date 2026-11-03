import { describe, expect, it } from "vitest";
import { SITEMAP_PATHS, sitemapPaths } from "./sitemap";

describe("sitemapPaths", () => {
  it("lists the public pages, never the admin, checkout or order pages", () => {
    const paths = sitemapPaths();
    expect(paths).toEqual([...SITEMAP_PATHS]);
    for (const p of paths) expect(p).not.toMatch(/^\/(en\/)?(admin|porachka|order|checkout|kolichka|cart)/);
  });
});
