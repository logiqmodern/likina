import type { Metadata } from "next";
import { HomePage } from "@/components/site/pages/home";

export const metadata: Metadata = { alternates: { canonical: "/", languages: { bg: "/", en: "/en" } } };

export default function Page() {
  return <HomePage lang={"bg"} />;
}
