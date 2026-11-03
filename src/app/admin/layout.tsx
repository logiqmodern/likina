import type { Metadata, Viewport } from "next";
import { connection } from "next/server";

/*
 * Admin root (§10). Never indexed. Every page below authorizes itself with
 * requireAdmin() inside a <Suspense> boundary (Cache Components: reading the
 * session cookie is request-time), so no admin data is ever prerendered or
 * shared between users.
 */
export const metadata: Metadata = {
  title: { default: "Админ", template: "%s · Админ · Likina" },
  robots: { index: false, follow: false, nocache: true },
  referrer: "same-origin",
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
};

/**
 * Rendered per request with no prerendered shell: the strict CSP nonce (src/proxy.ts,
 * ADR 0005) can only reach scripts that are rendered at request time.
 */
export const instant = false;

export default async function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  await connection();
  return <div className="flex min-h-dvh flex-1 flex-col bg-[#F7F4EF] text-ink">{children}</div>;
}
