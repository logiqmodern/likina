import { staticMetadata } from "@/components/site/pages/content";
import { GalleryRoute } from "@/components/site/pages/gallery";
import { messages } from "@/i18n";

export const metadata = staticMetadata("en", "gallery", messages.en.gallery.title, messages.en.gallery.lead);

export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <GalleryRoute lang="en" {...props} />;
}
