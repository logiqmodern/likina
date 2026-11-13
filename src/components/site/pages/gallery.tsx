import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CATEGORY_SLUGS, href, messages, type Lang } from "@/i18n";
import { listArtists, listPublicArtworks } from "@/server/catalog";
import { ArtworkGrid } from "../artwork-card";
import { categoryName, SiteShell } from "../shell";

/*
 * Gallery and the four category pages (§4.2, v1 filters: artist, category,
 * availability). Filters live in the URL: ?avtor=<artist slug>&vsichki=1.
 */

export type GalleryQuery = { avtor?: string; vsichki?: string };

function qs(base: string, q: GalleryQuery): string {
  const s = new URLSearchParams();
  if (q.avtor) s.set("avtor", q.avtor);
  if (q.vsichki) s.set("vsichki", "1");
  const str = s.toString();
  return str ? `${base}?${str}` : base;
}

function Chip({ href: to, current, children }: { href: string; current: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={to}
      aria-current={current ? "page" : undefined}
      className={`inline-flex min-h-11 items-center rounded-full border px-4 text-[15px] font-semibold ${current ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}
    >
      {children}
    </Link>
  );
}

export async function GalleryPage({ lang, category, query }: { lang: Lang; category?: string; query: GalleryQuery }) {
  const t = messages[lang].gallery;
  const [all, artists] = await Promise.all([listPublicArtworks(), listArtists()]);
  const base = category ? href.category(lang, category) : href.page(lang, "gallery");
  const otherLang: Lang = lang === "bg" ? "en" : "bg";
  const alt = qs(category ? href.category(otherLang, category) : href.page(otherLang, "gallery"), query);

  const items = all.filter(
    (a) =>
      (!category || a.categorySlugs.includes(category)) &&
      (!query.avtor || a.artistSlug === query.avtor) &&
      (query.vsichki ? true : a.status === "available"),
  );
  const title = category ? categoryName(lang, category) : t.title;

  return (
    <SiteShell lang={lang} alt={alt}>
      <div className="container-site flex flex-col gap-6 py-8">
        <div className="flex flex-col gap-2">
          <h1 className="h1">{title}</h1>
          {!category ? <p className="text-[17px] text-ink-2">{t.lead}</p> : null}
        </div>

        <div className="flex flex-col gap-3">
          {!category ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label={t.category}>
              <Chip href={qs(href.page(lang, "gallery"), query)} current>
                {t.all}
              </Chip>
              {CATEGORY_SLUGS.map((c) => (
                <Chip key={c.bg} href={qs(href.category(lang, c.bg), query)} current={false}>
                  {categoryName(lang, c.bg)}
                </Chip>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2" role="group" aria-label={t.artist}>
            <Chip href={qs(base, { ...query, avtor: undefined })} current={!query.avtor}>
              {t.all}
            </Chip>
            {artists.map((a) => (
              <Chip key={a.id} href={qs(base, { ...query, avtor: a.slug })} current={query.avtor === a.slug}>
                {lang === "bg" ? a.nameBg : a.nameEn}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip href={qs(base, { ...query, vsichki: undefined })} current={!query.vsichki}>
              {t.available}
            </Chip>
            <Chip href={qs(base, { ...query, vsichki: "1" })} current={!!query.vsichki}>
              {t.withSold}
            </Chip>
          </div>
        </div>

        <p className="text-[15px] text-muted" aria-live="polite">
          {t.count(items.length)}
        </p>
        {items.length ? (
          <ArtworkGrid lang={lang} items={items} />
        ) : (
          <p className="text-ink-2">
            {t.empty}{" "}
            <Link href={base} className="link font-semibold">
              {t.reset}
            </Link>
          </p>
        )}
      </div>
    </SiteShell>
  );
}

type RouteProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function queryOf(sp: Record<string, string | string[] | undefined>): GalleryQuery {
  return { avtor: typeof sp.avtor === "string" ? sp.avtor : undefined, vsichki: sp.vsichki ? "1" : undefined };
}

async function GalleryBody({ lang, category, searchParams }: RouteProps & { lang: Lang; category?: string }) {
  return <GalleryPage lang={lang} category={category} query={queryOf(await searchParams)} />;
}

/** Route body for /galeriya and the four category pages (filters come from the URL → request-time). */
export function GalleryRoute({ lang, category, searchParams }: RouteProps & { lang: Lang; category?: string }) {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <GalleryBody lang={lang} category={category} searchParams={searchParams} />
    </Suspense>
  );
}

export function categoryMetadata(lang: Lang, bgSlug: string): Metadata {
  return {
    title: categoryName(lang, bgSlug),
    alternates: { canonical: href.category(lang, bgSlug), languages: { bg: href.category("bg", bgSlug), en: href.category("en", bgSlug) } },
  };
}
