import type { Metadata } from "next";
import { HomePage } from "@/components/site/pages/home";

export const metadata: Metadata = { title: { absolute: "Likina — hand-painted icons and paintings with gold | Online shop" }, description: "Likina family atelier, Sofia: original hand-painted Orthodox icons, paintings with gold, abstract paintings and art prints by Gergana Nikiforova and Rumen Bozhinov. Free delivery within Bulgaria.", alternates: { canonical: "/en", languages: { bg: "/", en: "/en", "x-default": "/" } } };

export default function Page() {
  return <HomePage lang={"en"} />;
}
