import { ContentPage, pageMetadata } from "@/components/site/pages/content";

export const metadata = pageMetadata("bg", "faq");

export default function Page() {
  return <ContentPage lang={"bg"} page="faq" />;
}
