import type { Metadata } from "next";
import { HomePage } from "@/components/site/pages/home";

export const metadata: Metadata = { alternates: { canonical: "/en", languages: { bg: "/", en: "/en" } } };

export default function Page() {
  return <HomePage lang={"en"} />;
}
