import type { Metadata } from "next";
import { ComingSoon } from "@/components/site/coming-soon";

export const metadata: Metadata = {
  title: { absolute: "Likina — hand-painted icons and paintings" },
  description: "Likina family atelier. Our new website is coming soon — reach us by phone, e-mail or Instagram.",
  alternates: { languages: { bg: "/", en: "/en" } },
  openGraph: { locale: "en_US" },
};

/** Temporary page until the shop launches (Phase 4 replaces it). */
export default function HomeEn() {
  return <ComingSoon lang="en" />;
}
