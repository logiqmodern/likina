import type { Metadata } from "next";
import { Suspense } from "react";
import { ArtworkPage, artworkMetadata } from "@/components/site/pages/artwork";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return artworkMetadata("bg", (await params).slug);
}

async function Body({ params }: Props) {
  return <ArtworkPage lang={"bg"} slug={(await params).slug} />;
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <Body {...props} />
    </Suspense>
  );
}
