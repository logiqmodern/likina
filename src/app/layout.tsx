import type { Metadata, Viewport } from "next";
import { OG_BASE, ogImageUrl, SITE_NAME } from "@/components/site/seo";
import { siteIndexing } from "@/lib/indexing";
import "./globals.css";

const siteUrl =
  process.env.APP_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Likina — ръчно рисувани икони и картини",
    template: `%s · ${SITE_NAME}`,
  },
  applicationName: SITE_NAME,
  // Until launch nothing is indexed — SITE_INDEXING=on switches it on (src/lib/indexing.ts).
  robots: siteIndexing() ? { index: true, follow: true } : { index: false, follow: false },
  openGraph: { ...OG_BASE, images: [{ url: ogImageUrl(null), width: 1200, height: 630, alt: SITE_NAME }] },
  formatDetection: { telephone: false },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim()
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION.trim() }
    : undefined,
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
};

// The `lang` of a page is set per route group in Phase 4 (BG at /, EN at /en).
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="bg" className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
