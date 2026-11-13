import { Suspense } from "react";
import { ContactPage, pageMetadata } from "@/components/site/pages/content";

export const metadata = pageMetadata("en", "contact");

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Body({ searchParams }: Props) {
  const sp = await searchParams;
  return <ContactPage lang={"en"} artwork={typeof sp.tvorba === "string" ? sp.tvorba.slice(0, 200) : undefined} />;
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<ContactPage lang={"en"} />}>
      <Body {...props} />
    </Suspense>
  );
}
