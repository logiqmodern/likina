import type { Metadata, Viewport } from "next";
import { OG_BASE, ogImageUrl, SITE_NAME } from "@/components/site/seo";
import { siteIndexing } from "@/lib/indexing";
import type { Lang } from "@/i18n";

const siteUrl =
  process.env.APP_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

/** Root metadata shared by the BG (/) and EN (/en) root layouts. */
export function rootMetadata(lang: Lang): Metadata {
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: lang === "bg" ? "Likina — ръчно рисувани икони и картини" : "Likina — hand-painted icons and paintings",
      template: `%s · ${SITE_NAME}`,
    },
    applicationName: SITE_NAME,
    // Until launch nothing is indexed — SITE_INDEXING=on switches it on (src/lib/indexing.ts).
    robots: siteIndexing() ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { ...OG_BASE, locale: lang === "bg" ? "bg_BG" : "en_GB", images: [{ url: ogImageUrl(null), width: 1200, height: 630, alt: SITE_NAME }] },
    formatDetection: { telephone: false },
    verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim()
      ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION.trim() }
      : undefined,
  };
}

export const rootViewport: Viewport = { themeColor: "#FBF9F5", width: "device-width", initialScale: 1 };

export function RootHtml({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return (
    <html lang={lang} className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
