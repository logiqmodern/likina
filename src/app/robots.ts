import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/components/site/seo";
import { NOINDEX_PATHS, siteIndexing } from "@/lib/indexing";

/** /robots.txt (§11): closed before launch; afterwards everything but the private paths. */
export default function robots(): MetadataRoute.Robots {
  if (!siteIndexing()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...NOINDEX_PATHS] },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
