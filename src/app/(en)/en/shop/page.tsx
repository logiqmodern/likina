import { staticMetadata } from "@/components/site/pages/content";
import { GalleryRoute } from "@/components/site/pages/gallery";

export const metadata = staticMetadata("en", "gallery", "Shop — hand-painted icons and paintings with gold", "Original hand-painted Orthodox icons, paintings with gold, abstract paintings and art prints from the Likina atelier. Free delivery within Bulgaria, pay by card or cash on delivery.");

export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <GalleryRoute lang="en" {...props} />;
}
