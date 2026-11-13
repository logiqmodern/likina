import { categoryMetadata, GalleryRoute } from "@/components/site/pages/gallery";

export const metadata = categoryMetadata("en", "ikoni");

export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <GalleryRoute lang="en" category="ikoni" {...props} />;
}
