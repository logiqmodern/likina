import { describe, expect, it } from "vitest";
import {
  compareAtWarning,
  formatEur,
  lowestPriceLast30Days,
  parseEurToCents,
  percentOf,
  quoteOrder,
  shippingCents,
} from "./pricing";

const settings = { pickupDiscountPercent: 5, shippingModel: "included" as const };

describe("quoteOrder", () => {
  it("delivery with Econt: shipping is included, no discount", () => {
    const q = quoteOrder([{ unitPriceCents: 45_000, qty: 1 }], "econt_office", settings);
    expect(q).toMatchObject({ subtotalCents: 45_000, discountCents: 0, shippingCents: 0, totalCents: 45_000 });
    expect(q.snapshot).toEqual({ deliveryMethod: "econt_office", pickupDiscountPercent: 5, shippingModel: "included" });
  });

  it("pickup from the atelier: −5 % of the subtotal, half-up to the cent", () => {
    // 5 % of 333,33 € = 16,6665 € → 16,67 €
    const q = quoteOrder([{ unitPriceCents: 33_333, qty: 1 }], "pickup", settings);
    expect(q.discountCents).toBe(1_667);
    expect(q.totalCents).toBe(31_666);
  });

  it("sums several lines (prints can have qty > 1)", () => {
    const q = quoteOrder(
      [
        { unitPriceCents: 8_000, qty: 2 },
        { unitPriceCents: 52_000, qty: 1 },
      ],
      "econt_address",
      settings,
    );
    expect(q.subtotalCents).toBe(68_000);
    expect(q.totalCents).toBe(68_000);
  });

  it("uses the discount setting, including 0 %", () => {
    expect(quoteOrder([{ unitPriceCents: 10_000, qty: 1 }], "pickup", { ...settings, pickupDiscountPercent: 0 }).totalCents).toBe(10_000);
    expect(quoteOrder([{ unitPriceCents: 10_000, qty: 1 }], "pickup", { ...settings, pickupDiscountPercent: 10 }).totalCents).toBe(9_000);
  });

  it("rejects empty orders and invalid lines", () => {
    expect(() => quoteOrder([], "econt_office", settings)).toThrow(RangeError);
    expect(() => quoteOrder([{ unitPriceCents: 100, qty: 0 }], "econt_office", settings)).toThrow(RangeError);
    expect(() => quoteOrder([{ unitPriceCents: 10.5, qty: 1 }], "econt_office", settings)).toThrow(RangeError);
  });

  it("shipping is 0 for every method while it is included", () => {
    for (const m of ["econt_office", "econt_address", "econt_locker", "pickup"] as const) {
      expect(shippingCents(m, "included")).toBe(0);
    }
  });
});

describe("percentOf", () => {
  it("rounds half-up", () => {
    expect(percentOf(10, 5)).toBe(1); // 0.5 → 1
    expect(percentOf(9, 5)).toBe(0); // 0.45 → 0
    expect(percentOf(0, 5)).toBe(0);
  });
});

describe("parseEurToCents", () => {
  it.each([
    ["450", 45_000],
    ["450,5", 45_050],
    ["450.50", 45_050],
    ["1 450 €", 145_000],
    ["0", 0],
  ])("%s → %d", (input, cents) => expect(parseEurToCents(input)).toBe(cents));

  it.each(["", "abc", "-5", "1,234", "4.555"])("rejects %j", (input) => expect(parseEurToCents(input)).toBeNull());
});

describe("formatEur", () => {
  it("formats BG and EN", () => {
    expect(formatEur(45_000)).toBe("450 €");
    expect(formatEur(6_084)).toBe("60,84 €");
    expect(formatEur(45_000, "en")).toBe("€450");
    expect(formatEur(145_050, "en")).toBe("€1,450.50");
  });
});

describe("lowestPriceLast30Days / compareAtWarning", () => {
  const d = (s: string) => new Date(`${s}T10:00:00Z`);

  it("takes the price in force at the window start and changes inside it", () => {
    const history = [
      { changedAt: d("2026-08-01"), priceCents: 50_000 },
      { changedAt: d("2026-10-20"), priceCents: 42_000 },
      { changedAt: d("2026-10-25"), priceCents: 48_000 },
    ];
    expect(lowestPriceLast30Days(history, d("2026-11-10"))).toBe(42_000);
    // reduction effective at 2026-11-10: the reduced price itself is not counted
    expect(lowestPriceLast30Days([...history, { changedAt: d("2026-11-10"), priceCents: 30_000 }], d("2026-11-10"))).toBe(42_000);
  });

  it("returns null without any price", () => {
    expect(lowestPriceLast30Days([], d("2026-11-10"))).toBeNull();
    expect(lowestPriceLast30Days([{ changedAt: d("2026-11-01"), priceCents: null }], d("2026-11-10"))).toBeNull();
  });

  it("warns when the crossed-out price is not higher or not the 30-day lowest", () => {
    expect(compareAtWarning(null, 40_000, 50_000)).toBeNull();
    expect(compareAtWarning(40_000, 40_000, 40_000)).toBe("compare_not_higher");
    expect(compareAtWarning(55_000, 40_000, 50_000)).toBe("compare_not_lowest_30d");
    expect(compareAtWarning(50_000, 40_000, 50_000)).toBeNull();
  });
});
