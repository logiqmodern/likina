import { absoluteUrl } from "@/components/site/seo";
import { CATEGORY_COPY } from "@/content/categories";
import { PAGES } from "@/content/pages";
import { CONTACTS_DEFAULT } from "@/domain/contacts";
import { formatDimensions } from "@/domain/artwork-size";
import { formatEur } from "@/domain/pricing";
import { CATEGORY_SLUGS, href } from "@/i18n";
import { listArtists, listPublicArtworks } from "@/server/catalog";

/*
 * /llms.txt (GEO): a plain summary of the shop for AI assistants — who we are,
 * what we sell, delivery, payment and returns, and the available works with
 * prices. Same facts as the site, from the same sources.
 */
export async function GET() {
  const [artworks, artists] = await Promise.all([listPublicArtworks(), listArtists()]);
  const available = artworks.filter((a) => a.status === "available" && a.priceCents !== null);
  const u = (p: string) => absoluteUrl(p);
  const faq = PAGES.faq.en.html
    .replace(/<h2>(.*?)<\/h2>/g, "\n### $1\n")
    .replace(/<p>(.*?)<\/p>/g, "$1\n")
    .replace(/<[^>]+>/g, "");

  const body = `# Likina Art Gallery (Ликина)

> Family atelier in Sofia, Bulgaria, and online shop for original hand-painted Orthodox icons, paintings with gold, abstract paintings and art prints by Gergana Nikiforova and Rumen Bozhinov (daughter and father). Prices in EUR. Free delivery within Bulgaria with Econt; pay by card (myPOS) or cash on delivery; 14-day right of withdrawal.

- Website (Bulgarian): ${u("/")}
- Website (English): ${u("/en")}
- Phone: ${CONTACTS_DEFAULT.phone}
- E-mail: ${CONTACTS_DEFAULT.email}
- Atelier: 12 Milin Kamak St., Lozenets, Sofia, Bulgaria — visits by appointment
- Instagram: ${CONTACTS_DEFAULT.instagram ?? "https://www.instagram.com/myartandfaith/"}
- Seller: Gergana Rumenova Nikiforova, craftsperson, EIK 177641226 (not VAT-registered)

## Categories

${CATEGORY_SLUGS.map((c) => `- [${CATEGORY_COPY[c.bg]!.en.name}](${u(href.category("en", c.bg))}) / [${CATEGORY_COPY[c.bg]!.bg.name}](${u(href.category("bg", c.bg))}): ${CATEGORY_COPY[c.bg]!.en.intro}`).join("\n")}

## Artists

${artists.map((a) => `- [${a.nameEn} (${a.nameBg})](${u(href.artist("en", a.slugEn))})`).join("\n")}

## Custom icons

Icons are painted to order: [${u(href.page("en", "customIcon"))}](${u(href.page("en", "customIcon"))}). Price and timing by agreement.

## Available works (${available.length})

${available
  .map((a) => {
    const size = formatDimensions(a, "en");
    return `- [${a.titleEn ?? a.titleBg}](${u(href.artwork("en", a.slugEn))}) — ${formatEur(a.priceCents!, "en")}${size ? `, ${size}` : ""}`;
  })
  .join("\n")}

## Delivery, payment, returns

- Delivery within Bulgaria only, with Econt (office, address or Econtomat locker); free — included in the price.
- Dispatch within 2–3 working days; parcels insured with declared value.
- Pick-up from the atelier in Sofia with a 5% discount.
- Payment by card (myPOS Checkout), cash on delivery, or on pick-up.
- 14-day right of withdrawal (not for works made to order).

## FAQ
${faq}`;

  return new Response(body, { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
