import Link from "next/link";
import { Suspense } from "react";
import { CONTACTS_DEFAULT, SELLER, telHref } from "@/domain/contacts";
import { CATEGORY_SLUGS, href, messages, type Lang } from "@/i18n";
import { readCart } from "@/server/cart";
import { Logo } from "./logo";

/*
 * Header + footer of the public site (§4). `alt` is the same page in the other
 * language (the BG/EN switch goes there). The mobile menu is a <details>: no JS.
 */

const CATEGORY_NAMES: Record<string, { bg: string; en: string }> = {
  ikoni: { bg: "Икони", en: "Icons" },
  "kartini-sas-zlato": { bg: "Картини със злато", en: "Gold paintings" },
  "abstraktni-kartini": { bg: "Абстрактни картини", en: "Abstract paintings" },
  "art-printove": { bg: "Арт принтове", en: "Art prints" },
};

export function categoryName(lang: Lang, bgSlug: string): string {
  return CATEGORY_NAMES[bgSlug]?.[lang] ?? bgSlug;
}

async function CartCount({ lang }: { lang: Lang }) {
  const n = (await readCart()).length;
  return (
    <Link href={href.page(lang, "cart")} className="relative inline-flex h-11 items-center gap-2 rounded-full px-3 font-semibold hover:bg-tint-50">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <path d="M6 7h12l-1 13H7L6 7Z" />
        <path d="M9 7a3 3 0 0 1 6 0" />
      </svg>
      <span className="sr-only">{messages[lang].nav.cart}</span>
      {n > 0 ? (
        <span className="grid h-6 min-w-6 place-items-center rounded-full bg-accent px-1.5 text-sm font-bold text-ink" aria-label={`${n}`}>
          {n}
        </span>
      ) : null}
    </Link>
  );
}

/** Main links; `withCategories` adds the four categories (mobile menu, footer). */
function NavLinks({ lang, withCategories = false, className = "nav-link" }: { lang: Lang; withCategories?: boolean; className?: string }) {
  const t = messages[lang].nav;
  return (
    <>
      <Link href={href.page(lang, "gallery")} className={className}>
        {t.gallery}
      </Link>
      {withCategories
        ? CATEGORY_SLUGS.map((c) => (
            <Link key={c.bg} href={href.category(lang, c.bg)} className={className}>
              {categoryName(lang, c.bg)}
            </Link>
          ))
        : null}
      <Link href={href.page(lang, "customIcon")} className={className}>
        {t.customIcon}
      </Link>
      <Link href={href.page(lang, "about")} className={className}>
        {t.about}
      </Link>
      <Link href={href.page(lang, "contact")} className={className}>
        {t.contact}
      </Link>
    </>
  );
}

export function SiteShell({ lang, alt, children }: { lang: Lang; alt: string; children: React.ReactNode }) {
  const t = messages[lang];
  const c = CONTACTS_DEFAULT;
  return (
    <>
      <a href="#main" className="sr-only-focusable absolute left-3 top-3 z-50 rounded-lg bg-white px-4 py-2 font-semibold">
        {t.nav.skip}
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur">
        <div className="container-site flex h-16 items-center justify-between gap-3">
          <Link href={href.page(lang, "home")} aria-label="Likina">
            <Logo />
          </Link>
          <nav aria-label={t.nav.menu} className="hidden items-center gap-1 lg:flex">
            <NavLinks lang={lang} />
          </nav>
          <div className="flex items-center gap-1">
            <Link href={alt} hrefLang={lang === "bg" ? "en" : "bg"} lang={lang === "bg" ? "en" : "bg"} className="nav-link">
              {lang === "bg" ? "EN" : "BG"}
              <span className="sr-only"> — {t.nav.switchTo}</span>
            </Link>
            <Suspense fallback={<span className="inline-block h-11 w-12" />}>
              <CartCount lang={lang} />
            </Suspense>
            <details className="group relative lg:hidden">
              <summary className="nav-link cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">{t.nav.menu}</span>
                <span className="hidden group-open:inline">{t.nav.close}</span>
              </summary>
              <nav aria-label={t.nav.menu} className="absolute right-0 top-12 flex w-64 flex-col rounded-2xl border border-line bg-white p-2 shadow-[var(--shadow-card)]">
                <NavLinks lang={lang} withCategories />
              </nav>
            </details>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="mt-16 border-t border-line bg-white">
        <div className="container-site grid gap-8 py-10 sm:grid-cols-3">
          <div className="flex flex-col gap-2 text-[15px]">
            <Logo />
            <a href={telHref(c.phone)} className="link font-semibold">
              {c.phone}
            </a>
            <a href={`mailto:${c.email}`} className="link">
              {c.email}
            </a>
            <p className="text-ink-2">
              {lang === "bg" ? c.street : "12 Milin Kamak St., Lozenets"}, {lang === "bg" ? c.city : "Sofia"}
              <br />
              {lang === "bg" ? c.hoursBg : c.hoursEn}
            </p>
            {c.instagram ? (
              <a href={c.instagram} rel="noopener" className="link">
                Instagram @myartandfaith
              </a>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 text-[15px]">
            <p className="font-bold">{t.nav.gallery}</p>
            <NavLinks lang={lang} withCategories className="link self-start" />
          </div>
          <div className="flex flex-col gap-2 text-[15px]">
            <p className="font-bold">{t.footer.legal}</p>
            {(["shipping", "faq", "terms", "privacy", "cookies"] as const).map((p) => (
              <Link key={p} href={href.page(lang, p)} className="link">
                {LEGAL_LABELS[p][lang]}
              </Link>
            ))}
            <p className="mt-2 text-ink-2">{t.footer.shippingOnly}</p>
            <p className="text-ink-2">{t.footer.payments}</p>
          </div>
        </div>
        <div className="border-t border-line">
          <p className="container-site py-4 text-[13px] text-muted">
            © Likina · {t.footer.seller}: {lang === "bg" ? `${SELLER.name}, ${SELLER.status}` : "Gergana Rumenova Nikiforova, craftsperson"}, ЕИК {SELLER.eik}. {t.footer.rights}
          </p>
        </div>
      </footer>
    </>
  );
}

export const LEGAL_LABELS = {
  shipping: { bg: "Доставка и връщане", en: "Shipping and returns" },
  faq: { bg: "Често задавани въпроси", en: "FAQ" },
  terms: { bg: "Общи условия", en: "Terms and conditions" },
  privacy: { bg: "Поверителност", en: "Privacy" },
  cookies: { bg: "Бисквитки", en: "Cookies" },
} as const;
