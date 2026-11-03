import { describe, expect, it } from "vitest";
import { breadcrumbLd, businessLd, e164Bg, geoFromMapsUrl, ldJson, servicesLd } from "./structured-data";

const base = {
  url: "https://lejishiotslabvash.com",
  name: "Лежиш и Отслабваш",
  telephone: "0887 374 755",
  email: "contact@lejishiotslabvash.com",
  street: "бул. Витоша 103",
  city: "София",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=x",
  image: null,
  hours: [
    { dayOfWeek: 1, openTime: "10:00:00", closeTime: "19:00:00" },
    { dayOfWeek: 6, openTime: "10:00", closeTime: "15:00" },
  ],
  pricesCents: [3000, 5900, 53000, 0],
  sameAs: [null, "#", "https://www.instagram.com/x"],
};

describe("structured data", () => {
  it("business: address, hours, price range from data; no geo / sameAs invented", () => {
    const ld = businessLd(base);
    expect(ld["@type"]).toBe("HealthAndBeautyBusiness");
    expect(ld.telephone).toBe("+359887374755");
    expect(ld.address).toMatchObject({ streetAddress: "бул. Витоша 103", addressLocality: "София", addressCountry: "BG" });
    expect(ld.openingHoursSpecification).toEqual([
      { "@type": "OpeningHoursSpecification", dayOfWeek: "https://schema.org/Monday", opens: "10:00", closes: "19:00" },
      { "@type": "OpeningHoursSpecification", dayOfWeek: "https://schema.org/Saturday", opens: "10:00", closes: "15:00" },
    ]);
    expect(ld.priceRange).toBe("30–530 €");
    expect("geo" in ld).toBe(false);
    expect(ld.sameAs).toEqual(["https://www.instagram.com/x"]);
  });

  it("geo only when the maps link carries coordinates", () => {
    expect(geoFromMapsUrl("https://www.google.com/maps/place/X/@42.6869,23.3185,17z")).toEqual({ latitude: 42.6869, longitude: 23.3185 });
    expect(geoFromMapsUrl("https://maps.google.com/?q=x")).toBeNull();
    expect(geoFromMapsUrl(null)).toBeNull();
  });

  it("phone numbers in E.164", () => {
    expect(e164Bg("+359 887 374 755")).toBe("+359887374755");
    expect(e164Bg("0887 374 755")).toBe("+359887374755");
  });

  it("services: offers in EUR linking to the booking flow", () => {
    const ld = servicesLd(base.url, [{ slug: "probna-procedura", name: "Пробна процедура", description: null, finalCents: 3000 }]);
    expect(ld.itemListElement[0]!.item.offers).toEqual({
      "@type": "Offer",
      price: "30",
      priceCurrency: "EUR",
      url: "https://lejishiotslabvash.com/zapishi-chas?usluga=probna-procedura",
    });
  });

  it("breadcrumbs and safe JSON", () => {
    const ld = breadcrumbLd(base.url, [
      { name: "Начало", path: "/" },
      { name: "Цени", path: "/ceni" },
    ]);
    expect(ld.itemListElement.map((i) => i.item)).toEqual(["https://lejishiotslabvash.com", "https://lejishiotslabvash.com/ceni"]);
    expect(ldJson({ a: "</script>" })).not.toContain("</script>");
  });
});
