import { categoryMetadata, GalleryRoute } from "@/components/site/pages/gallery";

export const metadata = categoryMetadata("bg", "ikoni");

export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <GalleryRoute lang="bg" category="ikoni" {...props} />;
}
