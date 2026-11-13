import { RootHtml, rootMetadata, rootViewport } from "@/components/site/root-html";
import "../globals.css";

/* Root layout for the Bulgarian site and the admin (<html lang="bg">). EN has its own root: app/(en)/layout.tsx. */
export const metadata = rootMetadata("bg");
export const viewport = rootViewport;

export default function BgRootLayout({ children }: { children: React.ReactNode }) {
  return <RootHtml lang="bg">{children}</RootHtml>;
}
