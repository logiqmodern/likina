import { RootHtml, rootMetadata, rootViewport } from "@/components/site/root-html";
import "../globals.css";

/* Root layout for the English site under /en (<html lang="en">). */
export const metadata = rootMetadata("en");
export const viewport = rootViewport;

export default function EnRootLayout({ children }: { children: React.ReactNode }) {
  return <RootHtml lang="en">{children}</RootHtml>;
}
