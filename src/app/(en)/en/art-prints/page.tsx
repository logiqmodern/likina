import { categoryMetadata, GalleryRoute } from "@/components/site/pages/gallery";

export const metadata = categoryMetadata("en", "art-printove");

export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <GalleryRoute lang="en" category="art-printove" {...props} />;
}
