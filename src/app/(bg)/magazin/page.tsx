import { staticMetadata } from "@/components/site/pages/content";
import { GalleryRoute } from "@/components/site/pages/gallery";

export const metadata = staticMetadata("bg", "gallery", "Магазин — ръчно рисувани икони и картини със злато", "Оригинални ръчно рисувани православни икони, картини със злато, абстрактни картини и арт принтове от ателие Ликина. Безплатна доставка в България, плащане с карта или наложен платеж.");

export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <GalleryRoute lang="bg" {...props} />;
}
