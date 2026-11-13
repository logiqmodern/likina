import { Suspense } from "react";
import { ContactPage, pageMetadata } from "@/components/site/pages/content";

export const metadata = pageMetadata("bg", "contact");

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Body({ searchParams }: Props) {
  const sp = await searchParams;
  return <ContactPage lang={"bg"} artwork={typeof sp.tvorba === "string" ? sp.tvorba.slice(0, 200) : undefined} />;
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<ContactPage lang={"bg"} />}>
      <Body {...props} />
    </Suspense>
  );
}
