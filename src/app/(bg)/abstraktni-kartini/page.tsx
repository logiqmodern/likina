import { categoryMetadata, GalleryRoute } from "@/components/site/pages/gallery";

export const metadata = categoryMetadata("bg", "abstraktni-kartini");

export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <GalleryRoute lang="bg" category="abstraktni-kartini" {...props} />;
}
