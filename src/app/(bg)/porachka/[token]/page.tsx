import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderPage } from "@/components/site/pages/order";

export const metadata: Metadata = { title: "Поръчка", robots: { index: false, follow: false }, referrer: "no-referrer" };

type Props = { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Body({ params, searchParams }: Props) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  return <OrderPage lang={"bg"} token={token} pay={sp.pay === "1"} />;
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <Body {...props} />
    </Suspense>
  );
}
