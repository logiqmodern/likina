import type { Metadata } from "next";
import { Suspense } from "react";
import { ArtistPage } from "@/components/site/pages/content";
import { href } from "@/i18n";
import { listArtists } from "@/server/catalog";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug;
  const a = (await listArtists()).find((x) => x.slug === slug || x.slugEn === slug);
  if (!a) return {};
  return { title: a.nameEn, alternates: { canonical: href.artist("en", slug), languages: { bg: href.artist("bg", a.slug), en: href.artist("en", a.slugEn) } } };
}

async function Body({ params }: Props) {
  return <ArtistPage lang={"en"} slug={(await params).slug} />;
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <Body {...props} />
    </Suspense>
  );
}
