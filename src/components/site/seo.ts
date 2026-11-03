import { withPlatformDefaults } from "@/lib/env";

/** Absolute URL on the site (APP_URL, or the Vercel URL); relative when neither is set — metadataBase then resolves it. */
export function absoluteUrl(path: string): string {
  const base = withPlatformDefaults(process.env).APP_URL;
  if (!base) return path;
  try {
    return new URL(path, base).toString();
  } catch {
    return path;
  }
}

export const SITE_NAME = "Likina";

/** Shared Open Graph fields (a page's openGraph replaces its parent's, so every page repeats them). */
export const OG_BASE = { siteName: SITE_NAME, locale: "bg_BG", type: "website" } as const;

/** Generated social image with the brand template. */
export function ogImageUrl(title?: string | null): string {
  return absoluteUrl(title ? `/og?t=${encodeURIComponent(title)}` : "/og");
}
