import Image from "next/image";
import Link from "next/link";
import { CATEGORY_COPY } from "@/content/categories";
import { CONTACTS_DEFAULT } from "@/domain/contacts";
import { CATEGORY_SLUGS, href, messages, pick, type Lang } from "@/i18n";
import { mediaSrc } from "@/lib/media";
import { organization, website } from "@/lib/structured-data";
import { listArtists, listCategories, listPublicArtworks, listReviews } from "@/server/catalog";
import { ArtworkGrid } from "../artwork-card";
import { HeroSlider, type HeroSlide } from "../hero-slider";
import { JsonLd } from "../json-ld";
import { SiteShell } from "../shell";
import { TrustStrip } from "../trust-strip";

/** First paragraph of a bio, without the surrounding quotes (the artist's own words). */
export function bioQuote(html: string | null): string | null {
  const first = /<p>(.*?)<\/p>/.exec(html ?? "")?.[1]?.replace(/<[^>]+>/g, "").trim();
  if (!first || !/^["„“«]/.test(first)) return null;
  return first.replace(/^["„“«]\s*/, "").replace(/\s*["“”»]$/, "");
}

const HOME_COPY = {
  bg: {
    hero: { prev: "Предишен слайд", next: "Следващ слайд", slide: "Слайд {n} от {total}", pause: "Пауза", play: "Пусни" },
    shopBy: "Пазарувайте по категория",
    works: (n: number) => (n === 1 ? "1 творба" : `${n} творби`),
    visitTitle: "Посетете ателието",
    visitText: "Вижте творбите на живо в София, ж.к. Лозенец — по предварителна уговорка.",
    call: "Обадете се",
  },
  en: {
    hero: { prev: "Previous slide", next: "Next slide", slide: "Slide {n} of {total}", pause: "Pause", play: "Play" },
    shopBy: "Shop by category",
    works: (n: number) => (n === 1 ? "1 artwork" : `${n} artworks`),
    visitTitle: "Visit the atelier",
    visitText: "See the works in person in Sofia, Lozenets — by appointment.",
    call: "Call us",
  },
};

export async function HomePage({ lang }: { lang: Lang }) {
  const t = messages[lang];
  const c = HOME_COPY[lang];
  const [artworks, categories, artists, reviews] = await Promise.all([listPublicArtworks(), listCategories(), listArtists(), listReviews()]);
  const available = artworks.filter((a) => a.status === "available");

  const slides: HeroSlide[] = CATEGORY_SLUGS.map((cat) => {
    const copy = CATEGORY_COPY[cat.bg]![lang];
    const pickArt = available.find((a) => a.categorySlugs.includes(cat.bg) && a.cover);
    return {
      key: cat.bg,
      eyebrow: copy.eyebrow,
      headline: copy.headline,
      text: copy.text,
      cta: { href: href.category(lang, cat.bg), label: copy.cta },
      image: pickArt?.cover ? { src: mediaSrc(pickArt.cover.id), alt: pick(lang, pickArt.cover.altBg, pickArt.cover.altEn).text ?? "" } : null,
    };
  });

  return (
    <SiteShell lang={lang} alt={href.page(lang === "bg" ? "en" : "bg", "home")}>
      <JsonLd data={[organization(lang), website(lang)]} />
      <HeroSlider slides={slides} labels={c.hero} />
      <TrustStrip lang={lang} />

      <section className="container-site flex flex-col gap-6 py-14" aria-labelledby="cats">
        <h2 id="cats" className="h2">
          {c.shopBy}
        </h2>
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {CATEGORY_SLUGS.map((cat) => {
            const dbCat = categories.find((x) => x.slug === cat.bg);
            const count = available.filter((a) => a.categorySlugs.includes(cat.bg)).length;
            const img = dbCat?.imageMediaId ?? available.find((a) => a.categorySlugs.includes(cat.bg))?.cover?.id;
            return (
              <li key={cat.bg}>
                <Link href={href.category(lang, cat.bg)} className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-tint-50">
                  {img ? <Image src={mediaSrc(img)} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" /> : null}
                  <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/75 via-black/40 to-transparent p-4 pt-16 text-white">
                    <span className="text-[19px] font-extrabold leading-tight">{CATEGORY_COPY[cat.bg]![lang].name}</span>
                    <span className="text-[14px] text-white/85">{c.works(count)} →</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="container-site flex flex-col gap-6 pb-14" aria-labelledby="new">
        <div className="flex items-end justify-between gap-4">
          <h2 id="new" className="h2">
            {t.home.newWorks}
          </h2>
          <Link href={href.page(lang, "gallery")} className="link font-semibold">
            {t.home.seeAll}
          </Link>
        </div>
        <ArtworkGrid lang={lang} items={available.slice(0, 8)} />
      </section>

      <section className="bg-white py-14" aria-labelledby="artists">
        <div className="container-site flex flex-col gap-8">
          <h2 id="artists" className="h2">
            {t.home.artists}
          </h2>
          <ul className="grid gap-8 md:grid-cols-2">
            {artists.map((a) => {
              const bio = pick(lang, a.bioBg, a.bioEn);
              const quote = bioQuote(bio.text);
              const name = lang === "bg" ? a.nameBg : a.nameEn;
              return (
                <li key={a.id} className="grid grid-cols-[112px_1fr] gap-5 sm:grid-cols-[150px_1fr]">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-tint-50">
                    {a.photoMediaId ? <Image src={mediaSrc(a.photoMediaId)} alt={name} fill sizes="150px" className="object-cover" /> : null}
                  </div>
                  <div className="flex flex-col gap-3">
                    <h3 className="h3">{name}</h3>
                    {quote ? (
                      <blockquote lang={bio.lang} className="border-l-2 border-accent pl-4 text-[16px] italic leading-relaxed text-ink-2">
                        {quote}
                      </blockquote>
                    ) : null}
                    <Link href={href.artist(lang, lang === "bg" ? a.slug : a.slugEn)} className="link mt-auto self-start font-semibold">
                      {t.home.artistLink}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="bg-ink py-14 text-white">
        <div className="container-site grid items-center gap-6 md:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-3">
            <p className="eyebrow text-accent">{t.home.customTitle}</p>
            <h2 className="h2 text-white">{lang === "bg" ? "Икона, изписана специално за Вас" : "An icon painted especially for you"}</h2>
            <p className="max-w-xl text-[17px] text-white/80">{t.home.customLead}</p>
          </div>
          <div className="md:justify-self-end">
            <Link href={href.page(lang, "customIcon")} className="btn btn-primary btn-lg">
              {t.home.ctaCustom}
            </Link>
          </div>
        </div>
      </section>

      {reviews.length ? (
        <section className="container-site flex flex-col gap-6 py-14" aria-labelledby="reviews">
          <h2 id="reviews" className="h2">
            {t.home.reviews}
          </h2>
          <ul className="columns-1 gap-4 md:columns-2 lg:columns-3">
            {reviews.map((r) => {
              const text = pick(lang, r.textBg, r.textEn);
              return (
                <li key={r.id} className="card mb-4 flex break-inside-avoid flex-col gap-3 p-6">
                  <span aria-hidden="true" className="font-serif text-[40px] leading-none text-accent-600">
                    “
                  </span>
                  <blockquote lang={text.lang} className="text-[16px] leading-relaxed text-ink-2">
                    {text.text}
                  </blockquote>
                  <p className="font-bold">— {r.authorName}</p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="container-site pb-6">
        <div className="grid gap-4 rounded-3xl bg-[#F3ECE1] p-8 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div className="flex flex-col gap-2">
            <h2 className="h2">{c.visitTitle}</h2>
            <p className="text-[17px] text-ink-2">{c.visitText}</p>
          </div>
          <div className="flex flex-wrap gap-3 md:justify-self-end">
            <a href={`tel:${CONTACTS_DEFAULT.phone.replace(/\s/g, "")}`} className="btn btn-dark">
              {c.call}
            </a>
            <a href="https://www.instagram.com/myartandfaith/" rel="noopener" className="btn btn-secondary">
              Instagram
            </a>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
