import { absoluteUrl } from "@/components/site/seo";
import { CONTACTS_DEFAULT, SELLER } from "@/domain/contacts";
import type { Lang } from "@/i18n";

/*
 * schema.org JSON-LD (§11 SEO, GEO): the atelier as an ArtGallery store, the
 * website, products with offers (price, availability, free shipping in BG,
 * 14-day returns), breadcrumbs, artists and the FAQ. Facts only from the
 * client's decisions and the catalogue.
 */

export const ORG_ID = absoluteUrl("/#likina");

export function organization(lang: Lang) {
  const c = CONTACTS_DEFAULT;
  return {
    "@context": "https://schema.org",
    "@type": ["ArtGallery", "Store"],
    "@id": ORG_ID,
    name: "Likina Art Gallery",
    alternateName: ["Ликина", "Likina"],
    url: absoluteUrl(lang === "bg" ? "/" : "/en"),
    logo: absoluteUrl("/icon.svg"),
    image: absoluteUrl("/og"),
    description:
      lang === "bg"
        ? "Семейно ателие в София: ръчно рисувани православни икони, картини със злато, абстрактни картини и арт принтове от Гергана Никифорова и Румен Божинов. Онлайн магазин с безплатна доставка в България."
        : "Family atelier in Sofia: hand-painted Orthodox icons, paintings with gold, abstract paintings and art prints by Gergana Nikiforova and Rumen Bozhinov. Online shop with free delivery within Bulgaria.",
    telephone: c.phone,
    email: c.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: lang === "bg" ? "ул. Милин камък 12" : "12 Milin Kamak St.",
      addressLocality: lang === "bg" ? "София" : "Sofia",
      addressRegion: lang === "bg" ? "ж.к. Лозенец" : "Lozenets",
      addressCountry: "BG",
    },
    areaServed: { "@type": "Country", name: "Bulgaria" },
    currenciesAccepted: "EUR",
    paymentAccepted: "Credit Card, Debit Card, Cash on delivery",
    sameAs: c.instagram ? [c.instagram] : [],
    founder: [
      { "@type": "Person", name: lang === "bg" ? "Гергана Никифорова" : "Gergana Nikiforova" },
      { "@type": "Person", name: lang === "bg" ? "Румен Божинов" : "Rumen Bozhinov" },
    ],
    legalName: SELLER.name,
    taxID: SELLER.eik,
  };
}

export function website(lang: Lang) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Likina Art Gallery",
    url: absoluteUrl(lang === "bg" ? "/" : "/en"),
    inLanguage: lang === "bg" ? "bg-BG" : "en",
    publisher: { "@id": ORG_ID },
  };
}

export function breadcrumbs(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
  };
}

const shippingDetails = {
  "@type": "OfferShippingDetails",
  shippingRate: { "@type": "MonetaryAmount", value: 0, currency: "EUR" },
  shippingDestination: { "@type": "DefinedRegion", addressCountry: "BG" },
  deliveryTime: {
    "@type": "ShippingDeliveryTime",
    handlingTime: { "@type": "QuantitativeValue", minValue: 2, maxValue: 3, unitCode: "DAY" },
    transitTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 3, unitCode: "DAY" },
  },
};

const returnPolicy = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: "BG",
  returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: 14,
  returnMethod: "https://schema.org/ReturnByMail",
  returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
};

export function product(p: {
  name: string;
  description: string;
  path: string;
  images: string[];
  priceCents: number | null;
  status: "available" | "reserved" | "sold";
  artist: string | null;
  category: string | null;
  material: string | null;
  widthMm: number | null;
  heightMm: number | null;
  kind: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": ["Product", "VisualArtwork"],
    name: p.name,
    description: p.description,
    url: absoluteUrl(p.path),
    image: p.images,
    brand: { "@type": "Brand", name: "Likina" },
    ...(p.artist ? { creator: { "@type": "Person", name: p.artist }, artist: { "@type": "Person", name: p.artist } } : {}),
    ...(p.category ? { category: p.category, artform: p.category } : {}),
    ...(p.material ? { artMedium: p.material, material: p.material } : {}),
    ...(p.widthMm && p.heightMm
      ? {
          width: { "@type": "Distance", name: `${p.widthMm / 10} cm` },
          height: { "@type": "Distance", name: `${p.heightMm / 10} cm` },
        }
      : {}),
    artEdition: p.kind === "original" ? 1 : undefined,
    ...(p.priceCents !== null
      ? {
          offers: {
            "@type": "Offer",
            url: absoluteUrl(p.path),
            price: (p.priceCents / 100).toFixed(2),
            priceCurrency: "EUR",
            availability: p.status === "available" ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
            itemCondition: "https://schema.org/NewCondition",
            seller: { "@id": ORG_ID },
            shippingDetails,
            hasMerchantReturnPolicy: returnPolicy,
          },
        }
      : {}),
  };
}

export function itemList(name: string, items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, url: absoluteUrl(it.path) })),
  };
}

export function person(p: { name: string; path: string; description: string; image: string | null; jobTitle: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: p.name,
    url: absoluteUrl(p.path),
    description: p.description,
    jobTitle: p.jobTitle,
    ...(p.image ? { image: p.image } : {}),
    worksFor: { "@id": ORG_ID },
  };
}

/** FAQPage from our FAQ HTML (<h2>question</h2><p>answer</p>…). */
export function faqPage(html: string) {
  const pairs = [...html.matchAll(/<h2>(.*?)<\/h2><p>(.*?)<\/p>/g)].map((m) => [m[1]!, m[2]!.replace(/<[^>]+>/g, "")]);
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pairs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
}
