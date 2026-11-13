import { AboutPage, pageMetadata } from "@/components/site/pages/content";

export const metadata = pageMetadata("en", "about");

export default function Page() {
  return <AboutPage lang={"en"} />;
}
