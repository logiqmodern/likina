import { ContentPage, pageMetadata } from "@/components/site/pages/content";

export const metadata = pageMetadata("bg", "terms");

export default function Page() {
  return <ContentPage lang={"bg"} page="terms" />;
}
