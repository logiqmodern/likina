import type { Metadata } from "next";
import { ComingSoon } from "@/components/site/coming-soon";

export const metadata: Metadata = {
  title: { absolute: "Likina — ръчно рисувани икони и картини" },
  description: "Семейно ателие Ликина. Новият сайт идва скоро — свържете се с нас по телефон, имейл или Instagram.",
  alternates: { languages: { bg: "/", en: "/en" } },
};

/** Temporary page until the shop launches (Phase 4 replaces it). */
export default function Home() {
  return <ComingSoon lang="bg" />;
}
