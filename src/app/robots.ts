import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/components/site/seo";
import { NOINDEX_PATHS, siteIndexing } from "@/lib/indexing";

/** AI assistants and their search crawlers are welcome too (GEO) — same rules as everyone. */
const AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "CCBot"];

/** /robots.txt (§11): closed before launch; afterwards everything but the private paths. */
export default function robots(): MetadataRoute.Robots {
  if (!siteIndexing()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: [...NOINDEX_PATHS] },
      { userAgent: AI_CRAWLERS, allow: "/", disallow: [...NOINDEX_PATHS] },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
