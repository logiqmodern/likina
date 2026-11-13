import { describe, expect, it } from "vitest";
import { faqPage, product } from "./structured-data";

describe("structured data", () => {
  it("product: offer with EUR price, availability, free BG shipping and 14-day returns", () => {
    const p = product({ name: "Св. Николай", description: "Икона", path: "/tvorba/sv-nikolay", images: [], priceCents: 25_500, status: "available", artist: "Гергана Никифорова", category: "Икони", material: null, widthMm: 160, heightMm: 200, kind: "original" });
    expect(p.offers).toMatchObject({ price: "255.00", priceCurrency: "EUR", availability: "https://schema.org/InStock" });
    expect(p.offers?.shippingDetails.shippingRate.value).toBe(0);
    expect(p.offers?.hasMerchantReturnPolicy.merchantReturnDays).toBe(14);
    expect(product({ name: "x", description: "", path: "/x", images: [], priceCents: null, status: "sold", artist: null, category: null, material: null, widthMm: null, heightMm: null, kind: "original" })).not.toHaveProperty("offers");
  });

  it("FAQ HTML → Question/Answer pairs", () => {
    const f = faqPage("<h2>Колко струва доставката?</h2><p>Безплатна е — <strong>включена</strong> в цената.</p><h2>Q2?</h2><p>A2</p>");
    expect(f.mainEntity).toEqual([
      { "@type": "Question", name: "Колко струва доставката?", acceptedAnswer: { "@type": "Answer", text: "Безплатна е — включена в цената." } },
      { "@type": "Question", name: "Q2?", acceptedAnswer: { "@type": "Answer", text: "A2" } },
    ]);
  });
});
