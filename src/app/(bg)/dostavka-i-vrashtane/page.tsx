import { ContentPage, pageMetadata } from "@/components/site/pages/content";

export const metadata = pageMetadata("bg", "shipping");

export default function Page() {
  return <ContentPage lang={"bg"} page="shipping" />;
}
