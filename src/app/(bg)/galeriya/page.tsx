import { staticMetadata } from "@/components/site/pages/content";
import { GalleryRoute } from "@/components/site/pages/gallery";
import { messages } from "@/i18n";

export const metadata = staticMetadata("bg", "gallery", messages.bg.gallery.title, messages.bg.gallery.lead);

export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <GalleryRoute lang="bg" {...props} />;
}
