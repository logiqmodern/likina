import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addToCart } from "@/app/_actions/cart";
import { formatDimensions } from "@/domain/artwork-size";
import { formatEur } from "@/domain/pricing";
import { DEFAULT_SETTINGS } from "@/domain/settings";
import { href, messages, pick, type Lang } from "@/i18n";
import { mediaSrc } from "@/lib/media";
import { absoluteUrl } from "@/components/site/seo";
import { CATEGORY_COPY } from "@/content/categories";
import { breadcrumbs, product } from "@/lib/structured-data";
import { getArtwork, listArtists, listPublicArtworks } from "@/server/catalog";
import { ArtworkGrid, Price } from "../artwork-card";
import { JsonLd } from "../json-ld";
import { SiteShell } from "../shell";

/* The artwork page (§4.3) — the most important page. */

export async function ArtworkPage({ lang, slug }: { lang: Lang; slug: string }) {
  const a = await getArtwork(decodeURIComponent(slug));
  if (!a) notFound();
  const t = messages[lang].artwork;
  const [artists, all] = await Promise.all([listArtists(), listPublicArtworks()]);
  const artist = artists.find((x) => x.id === a.artistId);
  const title = pick(lang, a.titleBg, a.titleEn);
  const description = pick(lang, a.descriptionBg, a.descriptionEn);
  const story = pick(lang, a.storyBg, a.storyEn);
  const technique = pick(lang, a.techniqueBg, a.techniqueEn);
  const materials = pick(lang, a.materialsBg, a.materialsEn);
  const size = formatDimensions(a, lang);
  const days = a.shipsInDays ?? DEFAULT_SETTINGS.shipsInDaysMax;
  const purchasable = a.status === "available" && a.priceCents !== null;
  const moreByArtist = all.filter((x) => x.artistSlug === artist?.slug && x.id !== a.id && x.status === "available").slice(0, 4);
  const alt = href.artwork(lang === "bg" ? "en" : "bg", lang === "bg" ? a.slugEn : a.slug);

  const specs: Array<[string, string | null, Lang]> = [
    [t.artist, artist ? (lang === "bg" ? artist.nameBg : artist.nameEn) : null, lang],
    [t.technique, technique.text, technique.lang],
    [t.materials, materials.text, materials.lang],
    [t.size, size ? `${size}${a.framed === true ? ` · ${t.framed.toLowerCase()}` : a.framed === false ? ` · ${t.unframed.toLowerCase()}` : ""}` : null, lang],
    [t.year, a.year ? String(a.year) : null, lang],
    [t.edition, a.kind === "original" ? t.oneOfAKind : a.kind === "print" ? (a.editionSize ? `${t.print}, ${a.editionNumber ?? "—"}/${a.editionSize}` : t.print) : null, lang],
  ];

  const buy = purchasable ? (
    <form action={addToCart}>
      <input type="hidden" name="artworkId" value={a.id} />
      <input type="hidden" name="lang" value={lang} />
      <button type="submit" className="btn btn-primary btn-lg w-full">
        {t.buy}
      </button>
    </form>
  ) : a.status === "sold" ? (
    <Link href={`${href.page(lang, "contact")}?tvorba=${encodeURIComponent(a.titleBg)}`} className="btn btn-secondary btn-lg w-full">
      {t.orderSimilar}
    </Link>
  ) : null;

  const card = all.find((x) => x.id === a.id);
  const catSlug = card?.categorySlugs.find((c) => CATEGORY_COPY[c]);
  const catName = catSlug ? CATEGORY_COPY[catSlug]![lang].name : null;
  const path = href.artwork(lang, lang === "bg" ? a.slug : a.slugEn);
  const plain = (description.text ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  return (
    <SiteShell lang={lang} alt={alt}>
      <JsonLd
        data={[
          product({
            name: title.text ?? a.titleBg,
            description: plain.slice(0, 5000) || (title.text ?? ""),
            path,
            images: a.images.map((i) => absoluteUrl(mediaSrc(i.id))),
            priceCents: a.priceCents,
            status: a.status as "available" | "reserved" | "sold",
            artist: artist ? (lang === "bg" ? artist.nameBg : artist.nameEn) : null,
            category: catName,
            material: [technique.text, materials.text].filter(Boolean).join("; ") || null,
            widthMm: a.widthMm,
            heightMm: a.heightMm,
            kind: a.kind,
          }),
          breadcrumbs([
            { name: messages[lang].nav.gallery, path: href.page(lang, "gallery") },
            ...(catSlug && catName ? [{ name: catName, path: href.category(lang, catSlug) }] : []),
            { name: title.text ?? a.titleBg, path },
          ]),
        ]}
      />
      <nav aria-label="Breadcrumb" className="container-site pt-5 text-[14px] text-ink-2">
        <Link href={href.page(lang, "gallery")} className="link">
          {messages[lang].nav.gallery}
        </Link>
        {catSlug && catName ? (
          <>
            {" / "}
            <Link href={href.category(lang, catSlug)} className="link">
              {catName}
            </Link>
          </>
        ) : null}
      </nav>
      <article className="container-site grid gap-8 py-6 pb-28 lg:grid-cols-[1.2fr_1fr] lg:gap-12 lg:py-10 lg:pb-10">
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label={title.text ?? ""}>
          {a.images.map((img, i) => (
            <a
              key={img.id}
              href={mediaSrc(img.id)}
              className="relative aspect-[4/5] w-[88%] shrink-0 snap-center overflow-hidden rounded-2xl bg-tint-50 lg:w-full"
              aria-label={t.photo(i + 1, a.images.length)}
            >
              <Image
                src={mediaSrc(img.id)}
                alt={pick(lang, img.altBg, img.altEn).text ?? ""}
                fill
                priority={i === 0}
                sizes="(min-width: 1024px) 55vw, 88vw"
                className="object-contain p-4"
              />
            </a>
          ))}
        </div>

        <div className="flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-col gap-2">
            {artist ? (
              <Link href={href.artist(lang, lang === "bg" ? artist.slug : artist.slugEn)} className="link text-[15px] font-semibold text-ink-2">
                {lang === "bg" ? artist.nameBg : artist.nameEn}
              </Link>
            ) : null}
            <h1 lang={title.lang} className="text-[28px] font-extrabold leading-tight sm:text-[34px]">
              {title.text}
            </h1>
            <p className="text-[22px]">
              {a.status === "sold" ? <span className="font-bold text-muted">{t.sold}</span> : a.status === "reserved" ? <span className="font-bold text-muted">{t.reserved}</span> : <Price lang={lang} cents={a.priceCents} compareAt={a.compareAtCents} />}
            </p>
            {a.status === "available" ? (
              <p className="text-[15px] text-ink-2">
                {a.kind === "original" ? `${t.oneOfAKind}. ` : ""}
                {t.shipsIn(DEFAULT_SETTINGS.shipsInDaysMin, days)}
              </p>
            ) : null}
          </div>

          <div className="hidden lg:block">{buy}</div>

          <ul className="flex flex-col gap-2 rounded-2xl bg-white p-4 text-[15px] text-ink-2">
            {t.trust.map((x) => (
              <li key={x} className="flex gap-2">
                <span aria-hidden="true" className="text-accent-600">
                  ✓
                </span>
                {x}
              </li>
            ))}
            {t.enOnly ? (
              <li className="pt-1 text-[14px]">
                {t.enOnly}{" "}
                <Link href={href.page(lang, "contact")} className="link">
                  {messages[lang].nav.contact}
                </Link>
              </li>
            ) : null}
          </ul>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
            {specs
              .filter(([, v]) => v)
              .map(([k, v, l]) => (
                <div key={k} className="contents">
                  <dt className="font-semibold text-muted">{k}</dt>
                  <dd lang={l}>{v}</dd>
                </div>
              ))}
          </dl>

          {description.text || story.text ? (
            <section className="flex flex-col gap-3" aria-labelledby="about-artwork">
              <h2 id="about-artwork" className="h3">
                {t.description}
              </h2>
              {description.text ? <div lang={description.lang} className="prose-likina" dangerouslySetInnerHTML={{ __html: description.text }} /> : null}
              {story.text ? <div lang={story.lang} className="prose-likina" dangerouslySetInnerHTML={{ __html: story.text }} /> : null}
            </section>
          ) : null}
        </div>
      </article>

      {moreByArtist.length && artist ? (
        <section className="container-site flex flex-col gap-6 py-8">
          <h2 className="h2">{t.moreBy(lang === "bg" ? artist.nameBg : artist.nameEn)}</h2>
          <ArtworkGrid lang={lang} items={moreByArtist} />
        </section>
      ) : null}

      {buy ? (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-4 border-t border-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="text-[18px]">{purchasable ? <Price lang={lang} cents={a.priceCents} /> : null}</div>
          <div className="flex-1">{buy}</div>
        </div>
      ) : null}
    </SiteShell>
  );
}

export async function artworkMetadata(lang: Lang, slug: string) {
  const a = await getArtwork(decodeURIComponent(slug));
  if (!a) return {};
  const artist = (await listArtists()).find((x) => x.id === a.artistId);
  const name = pick(lang, a.titleBg, a.titleEn).text ?? "";
  const title = a.status === "available" && a.priceCents !== null ? `${name} — ${formatEurPlain(a.priceCents)}` : name;
  const text = (pick(lang, a.descriptionBg, a.descriptionEn).text ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const facts = [
    artist ? (lang === "bg" ? `${a.kind === "print" ? "Арт принт" : "Оригинал"} от ${artist.nameBg}` : `${a.kind === "print" ? "Art print" : "Original"} by ${artist.nameEn}`) : null,
    pick(lang, a.techniqueBg, a.techniqueEn).text,
    formatDimensions(a, lang),
    lang === "bg" ? "Безплатна доставка в България." : "Free delivery within Bulgaria.",
  ].filter(Boolean);
  const desc = (text ? `${text.slice(0, 110)}… ${facts.slice(-1)}` : facts.join(". ")).slice(0, 160);
  return {
    title,
    description: desc,
    alternates: { canonical: href.artwork(lang, lang === "bg" ? a.slug : a.slugEn), languages: { bg: href.artwork("bg", a.slug), en: href.artwork("en", a.slugEn) } },
    openGraph: a.images[0]
      ? { type: "website" as const, siteName: "Likina", title, description: desc, images: [{ url: mediaSrc(a.images[0].id), width: a.images[0].width, height: a.images[0].height }] }
      : undefined,
  };
}

function formatEurPlain(cents: number): string {
  return formatEur(cents).replace(/\u00a0/g, " ");
}
