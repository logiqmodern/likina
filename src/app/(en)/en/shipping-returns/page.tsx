import { ContentPage, pageMetadata } from "@/components/site/pages/content";

export const metadata = pageMetadata("en", "shipping");

export default function Page() {
  return <ContentPage lang={"en"} page="shipping" />;
}
