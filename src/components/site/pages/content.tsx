import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PAGES } from "@/content/pages";
import { CONTACTS_DEFAULT, telHref } from "@/domain/contacts";
import { href, messages, pick, type Lang, type StaticPage } from "@/i18n";
import { mediaSrc } from "@/lib/media";
import { listArtists, listPublicArtworks } from "@/server/catalog";
import { ArtworkGrid } from "../artwork-card";
import { InquiryForm } from "../inquiry-form";
import { SiteShell } from "../shell";

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

export async function AboutPage({ lang }: { lang: Lang }) {
  const c = PAGES.about[lang];
  const artists = await listArtists();
  return (
    <SiteShell lang={lang} alt={href.page(other(lang), "about")}>
      <article className="container-site flex max-w-4xl flex-col gap-10 py-10">
        <div className="flex flex-col gap-4">
          <p className="eyebrow">{c.lead}</p>
          <h1 className="h1">{c.title}</h1>
          <div className="prose-likina" dangerouslySetInnerHTML={{ __html: c.html }} />
        </div>
        {artists.map((a) => {
          const bio = pick(lang, a.bioBg, a.bioEn);
          return (
            <section key={a.id} className="grid gap-6 sm:grid-cols-[200px_1fr]">
              {a.photoMediaId ? (
                <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-tint-50">
                  <Image src={mediaSrc(a.photoMediaId)} alt={lang === "bg" ? a.nameBg : a.nameEn} fill sizes="200px" className="object-cover" />
                </div>
              ) : null}
              <div className="flex flex-col gap-3">
                <h2 className="h2">{lang === "bg" ? a.nameBg : a.nameEn}</h2>
                {bio.text ? <div lang={bio.lang} className="prose-likina" dangerouslySetInnerHTML={{ __html: bio.text }} /> : null}
                <Link href={href.artist(lang, lang === "bg" ? a.slug : a.slugEn)} className="link font-semibold">
                  {messages[lang].home.artistLink}
                </Link>
              </div>
            </section>
          );
        })}
      </article>
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
