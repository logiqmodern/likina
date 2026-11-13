import { ContentPage, pageMetadata } from "@/components/site/pages/content";

export const metadata = pageMetadata("bg", "privacy");

export default function Page() {
  return <ContentPage lang={"bg"} page="privacy" />;
}
