import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CATEGORY_COPY } from "@/content/categories";
import { CATEGORY_SLUGS, href, messages, pick, type Lang } from "@/i18n";
import { breadcrumbs, itemList } from "@/lib/structured-data";
import { listArtists, listPublicArtworks } from "@/server/catalog";
import { ArtworkGrid } from "../artwork-card";
import { JsonLd } from "../json-ld";
import { SiteShell } from "../shell";

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

export async function GalleryPage({ lang, category, query }: { lang: Lang; category?: string; query: GalleryQuery }) {
  const t = messages[lang].gallery;
  const [all, artists] = await Promise.all([listPublicArtworks(), listArtists()]);
  const shop = href.page(lang, "gallery");
  const base = category ? href.category(lang, category) : shop;
  const otherLang: Lang = lang === "bg" ? "en" : "bg";
  const alt = qs(category ? href.category(otherLang, category) : href.page(otherLang, "gallery"), query);

  const visible = (a: (typeof all)[number]) => (!query.avtor || a.artistSlug === query.avtor) && (query.vsichki ? true : a.status === "available");
  const items = all.filter((a) => (!category || a.categorySlugs.includes(category)) && visible(a));
  const countIn = (cat?: string) => all.filter((a) => (!cat || a.categorySlugs.includes(cat)) && visible(a)).length;
  const copy = category ? CATEGORY_COPY[category]![lang] : null;
  const title = copy ? copy.name : t.title;
  const artistName = (slug: string) => {
    const a = artists.find((x) => x.slug === slug);
    return a ? (lang === "bg" ? a.nameBg : a.nameEn) : slug;
  };

  return (
    <SiteShell lang={lang} alt={alt}>
      <JsonLd
        data={[
          breadcrumbs([
            { name: messages[lang].nav.gallery, path: shop },
            ...(category ? [{ name: title, path: base }] : []),
          ]),
          itemList(title, items.slice(0, 50).map((a) => ({ name: pick(lang, a.titleBg, a.titleEn).text ?? "", path: href.artwork(lang, lang === "bg" ? a.slug : a.slugEn) }))),
        ]}
      />
      <div className="border-b border-line bg-[#F3ECE1]">
        <div className="container-site flex flex-col gap-3 py-10">
          {category ? (
            <nav aria-label="Breadcrumb" className="text-[14px] text-ink-2">
              <Link href={shop} className="link">
                {messages[lang].nav.gallery}
              </Link>{" "}
              / <span aria-current="page">{title}</span>
            </nav>
          ) : null}
          <h1 className="h1">{title}</h1>
          <p className="max-w-2xl text-[17px] leading-relaxed text-ink-2">{copy ? copy.intro : t.lead}</p>
        </div>
      </div>

      <div className="sticky top-16 z-20 border-b border-line bg-bg/95 backdrop-blur">
        <div className="container-site flex flex-col gap-2 py-3">
          <nav aria-label={t.category} className="-mx-1 flex gap-1 overflow-x-auto pb-1">
            {[{ bg: undefined as string | undefined, label: t.all }, ...CATEGORY_SLUGS.map((c) => ({ bg: c.bg as string | undefined, label: CATEGORY_COPY[c.bg]![lang].name }))].map((c) => {
              const current = c.bg === category;
              return (
                <Link
                  key={c.label}
                  href={qs(c.bg ? href.category(lang, c.bg) : shop, query)}
                  aria-current={current ? "page" : undefined}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[15px] font-semibold transition-colors ${current ? "bg-ink text-white" : "text-ink hover:bg-[#F3ECE1]"}`}
                >
                  {c.label}
                  <span className={`text-[13px] tabular-nums ${current ? "text-white/70" : "text-muted"}`}>{countIn(c.bg)}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <details className="group relative">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-line bg-white px-4 text-[15px] font-semibold hover:border-ink [&::-webkit-details-marker]:hidden">
                <span className="text-muted">{t.artist}:</span> {query.avtor ? artistName(query.avtor) : t.allArtists}
                <span aria-hidden="true" className="transition-transform group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <div className="absolute left-0 z-30 mt-2 flex w-60 flex-col rounded-2xl border border-line bg-white p-2 shadow-[var(--shadow-card)]">
                {[{ slug: undefined as string | undefined, name: t.allArtists }, ...artists.map((a) => ({ slug: a.slug as string | undefined, name: lang === "bg" ? a.nameBg : a.nameEn }))].map((a) => (
                  <Link
                    key={a.name}
                    href={qs(base, { ...query, avtor: a.slug })}
                    aria-current={query.avtor === a.slug ? "true" : undefined}
                    className="flex min-h-11 items-center justify-between rounded-xl px-3 text-[15px] hover:bg-[#F3ECE1] aria-[current=true]:font-bold"
                  >
                    {a.name}
                    {query.avtor === a.slug ? <span aria-hidden="true">✓</span> : null}
                  </Link>
                ))}
              </div>
            </details>

            <Link
              href={qs(base, { ...query, vsichki: query.vsichki ? undefined : "1" })}
              role="switch"
              aria-checked={!!query.vsichki}
              className="inline-flex min-h-11 items-center gap-3 text-[15px] font-semibold"
            >
              <span className={`relative h-6 w-11 rounded-full transition-colors ${query.vsichki ? "bg-ink" : "bg-line"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${query.vsichki ? "left-[22px]" : "left-0.5"}`} />
              </span>
              {t.withSold}
            </Link>

            <span className="ml-auto text-[14px] tabular-nums text-muted" aria-live="polite">
              {t.count(items.length)}
            </span>
          </div>
        </div>
      </div>

      <div className="container-site py-8">
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

/** Route body for /magazin and the four category pages (filters come from the URL → request-time). */
export function GalleryRoute({ lang, category, searchParams }: RouteProps & { lang: Lang; category?: string }) {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <GalleryBody lang={lang} category={category} searchParams={searchParams} />
    </Suspense>
  );
}

export function categoryMetadata(lang: Lang, bgSlug: string): Metadata {
  const copy = CATEGORY_COPY[bgSlug]![lang];
  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: { canonical: href.category(lang, bgSlug), languages: { bg: href.category("bg", bgSlug), en: href.category("en", bgSlug) } },
  };
}
