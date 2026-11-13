import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PAGES } from "@/content/pages";
import { CONTACTS_DEFAULT, telHref } from "@/domain/contacts";
import { href, messages, pick, type Lang, type StaticPage } from "@/i18n";
import { mediaSrc } from "@/lib/media";
import { faqPage, person } from "@/lib/structured-data";
import { listArtists, listPublicArtworks } from "@/server/catalog";
import { ArtworkGrid } from "../artwork-card";
import { InquiryForm } from "../inquiry-form";
import { JsonLd } from "../json-ld";
import { absoluteUrl } from "../seo";
import { SiteShell } from "../shell";
import { bioQuote } from "./home";

type CopyPage = keyof typeof PAGES;
const other = (lang: Lang): Lang => (lang === "bg" ? "en" : "bg");

export function pageMetadata(lang: Lang, page: CopyPage): Metadata {
  const c = PAGES[page][lang];
  return {
    title: c.title,
    description: c.description,
    alternates: { canonical: href.page(lang, page), languages: { bg: href.page("bg", page), en: href.page("en", page) } },
  };
}

export function staticMetadata(lang: Lang, page: StaticPage, title: string, description?: string): Metadata {
  return { title, description, alternates: { canonical: href.page(lang, page), languages: { bg: href.page("bg", page), en: href.page("en", page) } } };
}

/** Text pages: shipping, FAQ, terms, privacy, cookies. */
export function ContentPage({ lang, page }: { lang: Lang; page: CopyPage }) {
  const c = PAGES[page][lang];
  return (
    <SiteShell lang={lang} alt={href.page(other(lang), page)}>
      {page === "faq" ? <JsonLd data={faqPage(c.html)} /> : null}
      <article className="container-site flex max-w-3xl flex-col gap-6 py-10">
        <h1 className="h1">{c.title}</h1>
        {c.lead ? <p className="text-[18px] text-ink-2">{c.lead}</p> : null}
        <div className="prose-likina" dangerouslySetInnerHTML={{ __html: c.html }} />
      </article>
    </SiteShell>
  );
}

function ContactCard({ lang }: { lang: Lang }) {
  const c = CONTACTS_DEFAULT;
  const t = messages[lang].forms;
  return (
    <dl className="card flex flex-col gap-4 p-5">
      <div>
        <dt className="text-[13px] font-semibold text-muted">{t.phone}</dt>
        <dd>
          <a href={telHref(c.phone)} className="text-lg font-bold underline underline-offset-4">
            {c.phone}
          </a>
        </dd>
      </div>
      <div>
        <dt className="text-[13px] font-semibold text-muted">{t.email}</dt>
        <dd>
          <a href={`mailto:${c.email}`} className="break-all text-lg font-bold underline underline-offset-4">
            {c.email}
          </a>
        </dd>
      </div>
      <div>
        <dt className="text-[13px] font-semibold text-muted">{lang === "bg" ? "Ателие" : "Atelier"}</dt>
        <dd>
          {lang === "bg" ? `${c.street}, ${c.city}` : "12 Milin Kamak St., Lozenets, Sofia"}
          <span className="block text-ink-2">{lang === "bg" ? c.hoursBg : c.hoursEn}</span>
          {c.mapUrl ? (
            <a href={c.mapUrl} rel="noopener" className="link text-[15px]">
              {lang === "bg" ? "Виж на картата" : "View on the map"}
            </a>
          ) : null}
        </dd>
      </div>
    </dl>
  );
}

export function ContactPage({ lang, artwork }: { lang: Lang; artwork?: string }) {
  const c = PAGES.contact[lang];
  return (
    <SiteShell lang={lang} alt={href.page(other(lang), "contact")}>
      <div className="container-site grid gap-8 py-10 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-5">
          <h1 className="h1">{c.title}</h1>
          <p className="text-[17px] text-ink-2">{c.lead}</p>
          <ContactCard lang={lang} />
        </div>
        <div className="card p-5 sm:p-7">
          {artwork ? (
            <InquiryForm lang={lang} type="similar_artwork" fields={["name", "email", "phone", "artwork", "message"]} initial={{ artwork }} />
          ) : (
            <InquiryForm lang={lang} type="contact" fields={["name", "email", "phone", "message"]} />
          )}
        </div>
      </div>
    </SiteShell>
  );
}

export async function CustomIconPage({ lang }: { lang: Lang }) {
  const c = PAGES.customIcon[lang];
  const examples = (await listPublicArtworks()).filter((a) => a.categorySlugs.includes("ikoni") && a.cover).slice(0, 4);
  return (
    <SiteShell lang={lang} alt={href.page(other(lang), "customIcon")}>
      <div className="container-site grid gap-8 py-10 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-5">
          <h1 className="h1">{c.title}</h1>
          <p className="text-[18px] text-ink-2">{c.lead}</p>
          <div className="prose-likina" dangerouslySetInnerHTML={{ __html: c.html }} />
        </div>
        <div className="card p-5 sm:p-7">
          <InquiryForm lang={lang} type="custom_icon" fields={["name", "email", "phone", "subject", "size", "deadline", "message"]} />
        </div>
      </div>
      {examples.length ? (
        <section className="container-site flex flex-col gap-6 py-6">
          <h2 className="h2">{lang === "bg" ? "Икони от ателието" : "Icons from the atelier"}</h2>
          <ArtworkGrid lang={lang} items={examples} />
        </section>
      ) : null}
    </SiteShell>
  );
}

const ABOUT = {
  bg: {
    eyebrow: "Семейно ателие · София",
    title: "Двама автори. Едно ателие.",
    values: [
      { title: "Изцяло на ръка", text: "Всяка икона и всяка оригинална картина е рисувана на ръка от начало до край." },
      { title: "Истинско злато", text: "В иконите се използва 23-каратово злато, нанесено на ръка." },
      { title: "Оригинал в един екземпляр", text: "Оригиналите са уникати. Когато творба бъде продадена, тя изчезва от магазина." },
    ],
    roles: { "gergana-nikiforova": "Зограф и художник", "rumen-bozhinov": "Художник" } as Record<string, string>,
    works: "Творби в магазина",
    cta: "Към магазина",
    custom: "Икона по поръчка",
    visit: "Искате да видите творбите на живо? Заповядайте в ателието в София, ж.к. Лозенец — по предварителна уговорка.",
  },
  en: {
    eyebrow: "Family atelier · Sofia",
    title: "Two artists. One atelier.",
    values: [
      { title: "Entirely by hand", text: "Every icon and every original painting is painted by hand from start to finish." },
      { title: "Real gold", text: "The icons are gilded by hand with 23-carat gold." },
      { title: "One of a kind", text: "Originals are unique. Once a work is sold, it leaves the shop." },
    ],
    roles: { "gergana-nikiforova": "Icon painter and artist", "rumen-bozhinov": "Artist" } as Record<string, string>,
    works: "Works in the shop",
    cta: "Visit the shop",
    custom: "Custom icon",
    visit: "Would you like to see the works in person? Visit the atelier in Sofia, Lozenets — by appointment.",
  },
};

/** The bio without its first paragraph when that paragraph is the quote shown separately. */
function bioRest(html: string): string {
  const rest = bioQuote(html) ? html.replace(/^\s*<p>.*?<\/p>\s*/, "") : html;
  // "<p>Образование:</p>" → a sub-heading, so the CV parts are scannable
  return rest
    .replace(/<p>([^<]{2,40}):<\/p>/g, "<h3>$1</h3>")
    .replace(/<p>([\p{L} ]{2,20}): /gu, "<p><strong>$1:</strong> ");
}

export async function AboutPage({ lang }: { lang: Lang }) {
  const c = PAGES.about[lang];
  const t = ABOUT[lang];
  const [artists, works] = await Promise.all([listArtists(), listPublicArtworks()]);
  const available = works.filter((w) => w.status === "available" && w.cover);
  const collage = [available.find((w) => w.categorySlugs.includes("ikoni")), available.find((w) => w.categorySlugs.includes("kartini-sas-zlato")), available.find((w) => w.categorySlugs.includes("abstraktni-kartini"))].filter(Boolean);

  return (
    <SiteShell lang={lang} alt={href.page(other(lang), "about")}>
      <JsonLd
        data={artists.map((a) =>
          person({
            name: lang === "bg" ? a.nameBg : a.nameEn,
            path: href.artist(lang, lang === "bg" ? a.slug : a.slugEn),
            description: (pick(lang, a.bioBg, a.bioEn).text ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300),
            image: a.photoMediaId ? absoluteUrl(mediaSrc(a.photoMediaId)) : null,
            jobTitle: t.roles[a.slug] ?? "",
          }),
        )}
      />
      <section className="bg-[#F3ECE1]">
        <div className="container-site grid items-center gap-10 py-14 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <p className="eyebrow text-accent-600">{t.eyebrow}</p>
            <h1 className="h1">{t.title}</h1>
            <div className="prose-likina" dangerouslySetInnerHTML={{ __html: c.html }} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {collage.map((w, i) => (
              <div key={w!.id} className={`relative overflow-hidden rounded-2xl bg-white shadow-[0_24px_48px_-28px_rgba(42,31,26,0.5)] ${i === 0 ? "row-span-2 aspect-[3/5]" : "aspect-square"}`}>
                <Image src={mediaSrc(w!.cover!.id)} alt={pick(lang, w!.cover!.altBg, w!.cover!.altEn).text ?? ""} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-contain p-3" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-site grid gap-6 py-14 md:grid-cols-3">
        {t.values.map((v) => (
          <div key={v.title} className="flex flex-col gap-2 border-t-2 border-accent pt-5">
            <h2 className="h3">{v.title}</h2>
            <p className="text-[16px] leading-relaxed text-ink-2">{v.text}</p>
          </div>
        ))}
      </section>

      {artists.map((a, i) => {
        const bio = pick(lang, a.bioBg, a.bioEn);
        const quote = bioQuote(bio.text);
        const name = lang === "bg" ? a.nameBg : a.nameEn;
        const theirs = available.filter((w) => w.artistSlug === a.slug).slice(0, 4);
        return (
          <section key={a.id} className={i % 2 === 0 ? "bg-white py-14" : "py-14"} aria-labelledby={`artist-${a.slug}`}>
            <div className="container-site grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <div className={`flex flex-col gap-5 ${i % 2 === 1 ? "lg:order-2" : ""}`}>
                {a.photoMediaId ? (
                  <div className="relative aspect-[4/5] w-full max-w-md overflow-hidden rounded-3xl bg-tint-50">
                    <Image src={mediaSrc(a.photoMediaId)} alt={name} fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
                  </div>
                ) : null}
                {quote ? (
                  <blockquote lang={bio.lang} className="max-w-md text-[22px] font-medium italic leading-snug text-ink">
                    „{quote}“
                  </blockquote>
                ) : null}
              </div>
              <div className="flex flex-col gap-5">
                <div>
                  <p className="eyebrow text-accent-600">{t.roles[a.slug]}</p>
                  <h2 id={`artist-${a.slug}`} className="h2">
                    {name}
                  </h2>
                </div>
                {bio.text ? <div lang={bio.lang} className="prose-likina max-w-2xl" dangerouslySetInnerHTML={{ __html: bioRest(bio.text) }} /> : null}
                {theirs.length ? (
                  <div className="flex flex-col gap-3 pt-2">
                    <p className="font-bold">{t.works}</p>
                    <ul className="grid grid-cols-4 gap-2">
                      {theirs.map((w) => (
                        <li key={w.id}>
                          <Link href={href.artwork(lang, lang === "bg" ? w.slug : w.slugEn)} className="relative block aspect-square overflow-hidden rounded-xl bg-white ring-1 ring-line">
                            <Image src={mediaSrc(w.cover!.id)} alt={pick(lang, w.titleBg, w.titleEn).text ?? ""} fill sizes="120px" className="object-contain p-1.5" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <Link href={href.artist(lang, lang === "bg" ? a.slug : a.slugEn)} className="link self-start font-semibold">
                      {messages[lang].home.artistLink}
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        );
      })}

      <section className="container-site py-14">
        <div className="flex flex-col items-start gap-5 rounded-3xl bg-ink p-8 text-white md:flex-row md:items-center md:justify-between">
          <p className="max-w-xl text-[18px] leading-relaxed text-white/85">{t.visit}</p>
          <div className="flex flex-wrap gap-3">
            <Link href={href.page(lang, "gallery")} className="btn btn-primary">
              {t.cta}
            </Link>
            <Link href={href.page(lang, "customIcon")} className="btn btn-secondary">
              {t.custom}
            </Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

export async function ArtistPage({ lang, slug }: { lang: Lang; slug: string }) {
  const artists = await listArtists();
  const a = artists.find((x) => x.slug === slug || x.slugEn === slug);
  if (!a) notFound();
  const works = (await listPublicArtworks()).filter((w) => w.artistSlug === a.slug && w.status === "available");
  const bio = pick(lang, a.bioBg, a.bioEn);
  const name = lang === "bg" ? a.nameBg : a.nameEn;
  return (
    <SiteShell lang={lang} alt={href.artist(other(lang), lang === "bg" ? a.slugEn : a.slug)}>
      <JsonLd
        data={person({
          name,
          path: href.artist(lang, lang === "bg" ? a.slug : a.slugEn),
          description: (bio.text ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300),
          image: a.photoMediaId ? absoluteUrl(mediaSrc(a.photoMediaId)) : null,
          jobTitle: ABOUT[lang].roles[a.slug] ?? "",
        })}
      />
      <div className="container-site flex flex-col gap-10 py-10">
        <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
          {a.photoMediaId ? (
            <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-tint-50">
              <Image src={mediaSrc(a.photoMediaId)} alt={name} fill priority sizes="220px" className="object-cover" />
            </div>
          ) : null}
          <div className="flex max-w-3xl flex-col gap-4">
            <h1 className="h1">{name}</h1>
            {bio.text ? <div lang={bio.lang} className="prose-likina" dangerouslySetInnerHTML={{ __html: bio.text }} /> : null}
          </div>
        </div>
        <section className="flex flex-col gap-6">
          <h2 className="h2">{messages[lang].gallery.count(works.length)}</h2>
          <ArtworkGrid lang={lang} items={works} />
        </section>
      </div>
    </SiteShell>
  );
}
