import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/components/site/seo";
import { sitemapPaths } from "@/lib/sitemap";

/** /sitemap.xml for Search Console (§11). */
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapPaths().map((path) => ({ url: absoluteUrl(path) }));
}
