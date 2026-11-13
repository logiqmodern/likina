import type { Metadata } from "next";
import { HomePage } from "@/components/site/pages/home";

export const metadata: Metadata = { title: { absolute: "Likina — ръчно рисувани икони и картини със злато | Онлайн магазин" }, description: "Семейно ателие Ликина, София: оригинални ръчно рисувани православни икони, картини със злато, абстрактни картини и арт принтове от Гергана Никифорова и Румен Божинов. Безплатна доставка в България.", alternates: { canonical: "/", languages: { bg: "/", en: "/en", "x-default": "/" } } };

export default function Page() {
  return <HomePage lang={"bg"} />;
}
