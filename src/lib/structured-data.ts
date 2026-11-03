/*
 * Schema.org JSON-LD (§11). Pure builders — the data comes from the CMS, the
 * booking schedule and the price catalogue, so nothing here is invented.
 */

import type { WeeklyHoursRow } from "./hours";

const DAY = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export interface BusinessInput {
  url: string;
  name: string;
  telephone: string;
  email: string;
  street: string;
  city: string;
  mapsUrl: string | null;
  image: string | null;
  hours: WeeklyHoursRow[];
  /** final prices in cents of the public services */
  pricesCents: number[];
  sameAs: Array<string | null>;
}

const hhmm = (t: string) => t.slice(0, 5);
const eur = (cents: number) => (cents / 100).toFixed(2).replace(/\.00$/, "");

/** "+359887374755" from a displayed number like "0887 374 755" / "+359 887 374 755". */
export function e164Bg(display: string): string {
  const digits = display.replace(/\D/g, "");
  if (digits.startsWith("359")) return `+${digits}`;
  if (digits.startsWith("0")) return `+359${digits.slice(1)}`;
  return `+${digits}`;
}

/** Coordinates from a Google Maps URL ("…/@42.6875,23.3197,17z…"), else null. */
export function geoFromMapsUrl(url: string | null): { latitude: number; longitude: number } | null {
  const m = url?.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/) ?? url?.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  return m ? { latitude: Number(m[1]), longitude: Number(m[2]) } : null;
}

export function businessLd(b: BusinessInput) {
  const geo = geoFromMapsUrl(b.mapsUrl);
  const prices = b.pricesCents.filter((c) => c > 0);
  const sameAs = b.sameAs.filter((u): u is string => !!u && u.startsWith("https://"));
  return {
    "@context": "https://schema.org",
    "@type": "HealthAndBeautyBusiness",
    "@id": `${b.url}/#business`,
    name: b.name,
    url: b.url,
    telephone: e164Bg(b.telephone),
    email: b.email,
    ...(b.image ? { image: b.image } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: b.street,
      addressLocality: b.city,
      addressCountry: "BG",
    },
    ...(geo ? { geo: { "@type": "GeoCoordinates", ...geo } } : {}),
    ...(b.mapsUrl ? { hasMap: b.mapsUrl } : {}),
    openingHoursSpecification: b.hours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${DAY[h.dayOfWeek - 1]}`,
      opens: hhmm(h.openTime),
      closes: hhmm(h.closeTime),
    })),
    ...(prices.length ? { priceRange: `${eur(Math.min(...prices))}–${eur(Math.max(...prices))} €`, currenciesAccepted: "EUR" } : {}),
    paymentAccepted: "Cash, Credit Card",
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export interface ServiceInput {
  slug: string;
  name: string;
  description: string | null;
  finalCents: number;
}

export function servicesLd(url: string, services: ServiceInput[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: services.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Service",
        name: s.name,
        ...(s.description ? { description: s.description } : {}),
        provider: { "@id": `${url}/#business` },
        areaServed: { "@type": "City", name: "София" },
        offers: {
          "@type": "Offer",
          price: eur(s.finalCents),
          priceCurrency: "EUR",
          url: `${url}/zapishi-chas?usluga=${encodeURIComponent(s.slug)}`,
        },
      },
    })),
  };
}

export function breadcrumbLd(url: string, trail: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      item: `${url}${t.path === "/" ? "" : t.path}`,
    })),
  };
}

/** JSON for a <script type="application/ld+json">: "<" escaped so text can never close the tag. */
export function ldJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
