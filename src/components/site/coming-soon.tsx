import Link from "next/link";
import { CONTACTS_DEFAULT, telHref } from "@/domain/contacts";
import { Logo } from "./logo";

/*
 * Temporary home page while the new shop is being built (the old WordPress
 * site went offline with the Superhosting account, 13.11.2026). Facts only:
 * contacts from src/domain/contacts.ts.
 */

const COPY = {
  bg: {
    eyebrow: "Семейно ателие Ликина",
    title: "Новият ни сайт идва съвсем скоро",
    body: "Междувременно ни пишете или звъннете за наличните икони и картини, за икона по поръчка или за всякакви въпроси.",
    phone: "Телефон",
    email: "Имейл",
    instagram: "Instagram",
    atelier: "Ателие",
    hours: CONTACTS_DEFAULT.hoursBg,
    switchLabel: "English",
    switchHref: "/en",
  },
  en: {
    eyebrow: "Likina family atelier",
    title: "Our new website is coming soon",
    body: "In the meantime, call or write to us about available icons and paintings, a commissioned icon, or any other question.",
    phone: "Phone",
    email: "E-mail",
    instagram: "Instagram",
    atelier: "Atelier",
    hours: CONTACTS_DEFAULT.hoursEn,
    switchLabel: "Български",
    switchHref: "/",
  },
} as const;

export function ComingSoon({ lang }: { lang: "bg" | "en" }) {
  const t = COPY[lang];
  const c = CONTACTS_DEFAULT;
  return (
    <main lang={lang} className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-5 py-12 sm:py-20">
      <div className="flex items-center justify-between">
        <Logo />
        <Link href={t.switchHref} hrefLang={lang === "bg" ? "en" : "bg"} className="text-[15px] font-semibold text-ink underline underline-offset-4">
          {t.switchLabel}
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-bold uppercase tracking-[0.1em] text-muted">{t.eyebrow}</p>
        <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{t.title}</h1>
        <p className="text-[17px] text-ink-2">{t.body}</p>
      </div>

      <dl className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 sm:p-6">
        <div>
          <dt className="text-[13px] font-semibold text-muted">{t.phone}</dt>
          <dd>
            <a href={telHref(c.phone)} className="text-lg font-bold text-ink underline underline-offset-4">
              {c.phone}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-[13px] font-semibold text-muted">{t.email}</dt>
          <dd>
            <a href={`mailto:${c.email}`} className="break-all text-lg font-bold text-ink underline underline-offset-4">
              {c.email}
            </a>
          </dd>
        </div>
        {c.instagram ? (
          <div>
            <dt className="text-[13px] font-semibold text-muted">{t.instagram}</dt>
            <dd>
              <a href={c.instagram} rel="noopener" className="text-lg font-bold text-ink underline underline-offset-4">
                @myartandfaith
              </a>
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[13px] font-semibold text-muted">{t.atelier}</dt>
          <dd className="font-semibold">
            {lang === "bg" ? `${c.street}, ${c.city}` : "Milin Kamak 12 St., Lozenets, Sofia"}
            <span className="block text-[15px] font-normal text-ink-2">{t.hours}</span>
          </dd>
        </div>
      </dl>
    </main>
  );
}
