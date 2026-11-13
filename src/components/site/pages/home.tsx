import Image from "next/image";
import Link from "next/link";
import { CATEGORY_SLUGS, href, messages, pick, type Lang } from "@/i18n";
import { mediaSrc } from "@/lib/media";
import { listArtists, listCategories, listPublicArtworks, listReviews } from "@/server/catalog";
import { ArtworkGrid } from "../artwork-card";
import { categoryName, SiteShell } from "../shell";

/** First sentence(s) of a rich-text bio, as plain text. */
function teaser(html: string | null, max = 220): string {
  const text = (html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, text.lastIndexOf(" ", max))}…`;
}

export async function HomePage({ lang }: { lang: Lang }) {
  const t = messages[lang];
  const [artworks, categories, artists, reviews] = await Promise.all([listPublicArtworks(), listCategories(), listArtists(), listReviews()]);
  const available = artworks.filter((a) => a.status === "available");
  const hero = available.find((a) => a.categorySlugs.includes("ikoni") && a.cover) ?? available.find((a) => a.cover);

  return (
    <SiteShell lang={lang} alt={href.page(lang === "bg" ? "en" : "bg", "home")}>
      <section className="container-site grid items-center gap-8 py-10 lg:grid-cols-2 lg:py-16">
        <div className="flex flex-col gap-5">
          <p className="eyebrow">{t.home.eyebrow}</p>
          <h1 className="h1">{t.home.title}</h1>
          <p className="text-[18px] leading-relaxed text-ink-2">{t.home.lead}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={href.page(lang, "gallery")} className="btn btn-primary btn-lg">
              {t.home.ctaGallery}
            </Link>
            <Link href={href.page(lang, "customIcon")} className="btn btn-secondary btn-lg">
              {t.home.ctaCustom}
            </Link>
          </div>
        </div>
        {hero?.cover ? (
          <Link href={href.artwork(lang, lang === "bg" ? hero.slug : hero.slugEn)} className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-tint-50">
            <Image
              src={mediaSrc(hero.cover.id)}
              alt={pick(lang, hero.cover.altBg, hero.cover.altEn).text ?? ""}
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-contain p-6"
            />
          </Link>
        ) : null}
      </section>

      <section className="container-site flex flex-col gap-6 py-8" aria-labelledby="cats">
        <h2 id="cats" className="h2">
          {t.home.categories}
        </h2>
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {CATEGORY_SLUGS.map((c) => {
            const cat = categories.find((x) => x.slug === c.bg);
            const count = available.filter((a) => a.categorySlugs.includes(c.bg)).length;
            const img = cat?.imageMediaId ?? available.find((a) => a.categorySlugs.includes(c.bg))?.cover?.id;
            return (
              <li key={c.bg}>
                <Link href={href.category(lang, c.bg)} className="group flex flex-col gap-2">
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-tint-50">
                    {img ? <Image src={mediaSrc(img)} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" /> : null}
                  </div>
                  <span className="font-bold group-hover:underline group-hover:underline-offset-4">{categoryName(lang, c.bg)}</span>
                  <span className="text-[14px] text-muted">{t.home.available(count)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="container-site flex flex-col gap-6 py-8" aria-labelledby="new">
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

      <section className="container-site flex flex-col gap-6 py-8" aria-labelledby="artists">
        <h2 id="artists" className="h2">
          {t.home.artists}
        </h2>
        <ul className="grid gap-6 md:grid-cols-2">
          {artists.map((a) => (
            <li key={a.id} className="card flex gap-4 p-4 sm:p-6">
              {a.photoMediaId ? (
                <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-tint-50 sm:h-36 sm:w-32">
                  <Image src={mediaSrc(a.photoMediaId)} alt={lang === "bg" ? a.nameBg : a.nameEn} fill sizes="128px" className="object-cover" />
                </div>
              ) : null}
              <div className="flex flex-col gap-2">
                <h3 className="h3">{lang === "bg" ? a.nameBg : a.nameEn}</h3>
                <p lang={pick(lang, a.bioBg, a.bioEn).lang} className="text-[15px] text-ink-2">
                  {teaser(pick(lang, a.bioBg, a.bioEn).text)}
                </p>
                <Link href={href.artist(lang, lang === "bg" ? a.slug : a.slugEn)} className="link mt-auto font-semibold">
                  {t.home.artistLink}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white py-10">
        <div className="container-site grid gap-8 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h2 className="h2">{t.home.trustTitle}</h2>
            <ul className="flex flex-col gap-2 text-[17px] text-ink-2">
              {t.artwork.trust.map((x) => (
                <li key={x} className="flex gap-3">
                  <span aria-hidden="true" className="text-accent-600">
                    ✦
                  </span>
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-4 rounded-2xl bg-tint-50 p-6">
            <h2 className="h2">{t.home.customTitle}</h2>
            <p className="text-[17px] text-ink-2">{t.home.customLead}</p>
            <Link href={href.page(lang, "customIcon")} className="btn btn-dark self-start">
              {t.home.ctaCustom}
            </Link>
          </div>
        </div>
      </section>

      {reviews.length ? (
        <section className="container-site flex flex-col gap-6 py-10" aria-labelledby="reviews">
          <h2 id="reviews" className="h2">
            {t.home.reviews}
          </h2>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r) => {
              const text = pick(lang, r.textBg, r.textEn);
              return (
                <li key={r.id} className="card flex flex-col gap-3 p-5">
                  <blockquote lang={text.lang} className="text-[16px] leading-relaxed text-ink-2">
                    „{text.text}“
                  </blockquote>
                  <p className="font-bold">{r.authorName}</p>
                </li>
              );
            })}
          </ul>
          <a href="https://www.instagram.com/myartandfaith/" rel="noopener" className="link self-start font-semibold">
            {t.home.instagram}
          </a>
        </section>
      ) : null}
    </SiteShell>
  );
}
