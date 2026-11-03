import { describe, expect, it } from "vitest";
import {
  applyDiscount,
  checkPriorPrice,
  computePrice,
  type Discount,
  effectivePriceAt,
  eurCentsToBgnStotinki,
  formatBgn,
  formatEur,
  fromDiscountSnapshot,
  lowestEffectivePrice,
  perSessionCents,
  type PriceState,
  toDiscountSnapshot,
  promoDiscountedCents,
} from "./pricing";

const NBSP = " ";
const at = (iso: string) => new Date(iso);
const DAY = 24 * 60 * 60 * 1000;

function discount(over: Partial<Discount> = {}): Discount {
  return {
    id: "d1",
    type: "percent",
    value: 50,
    label: "-50%",
    startsAt: at("2026-10-01T00:00:00Z"),
    endsAt: null,
    isActive: true,
    ...over,
  };
}

describe("applyDiscount", () => {
  it("percent rounds half-up to the cent", () => {
    expect(applyDiscount(6084, { type: "percent", value: 50 })).toBe(3042);
    expect(applyDiscount(101, { type: "percent", value: 50 })).toBe(50); // 50.5 off → 51 off
    expect(applyDiscount(1, { type: "percent", value: 50 })).toBe(0);
  });

  it("amount subtracts cents and never goes below zero", () => {
    expect(applyDiscount(6084, { type: "amount", value: 3084 })).toBe(3000);
    expect(applyDiscount(500, { type: "amount", value: 900 })).toBe(0);
  });

  it("100% is free, out-of-range percent throws", () => {
    expect(applyDiscount(5900, { type: "percent", value: 100 })).toBe(0);
    expect(() => applyDiscount(5900, { type: "percent", value: 0 })).toThrow(RangeError);
    expect(() => applyDiscount(5900, { type: "percent", value: 101 })).toThrow(RangeError);
  });

  it("rejects non-integer cents", () => {
    expect(() => applyDiscount(59.5, { type: "amount", value: 1 })).toThrow(RangeError);
  });
});

describe("computePrice", () => {
  const now = at("2026-10-10T12:00:00Z");

  it("no discount → base price", () => {
    const q = computePrice(5900, [], now);
    expect(q).toMatchObject({ baseCents: 5900, finalCents: 5900, savingsCents: 0, discount: null });
  });

  it("active discount applies; snapshot is JSON-safe", () => {
    const q = computePrice(11900, [discount({ type: "amount", value: 6000 })], now);
    expect(q.finalCents).toBe(5900);
    expect(q.savingsCents).toBe(6000);
    expect(q.percentOff).toBe(50); // 50.42% → 50
    expect(q.discount?.startsAt).toBe("2026-10-01T00:00:00.000Z");
    expect(JSON.parse(JSON.stringify(q.discount))).toEqual(q.discount);
  });

  it("ignores inactive, future and expired discounts (end is exclusive)", () => {
    expect(computePrice(5900, [discount({ isActive: false })], now).finalCents).toBe(5900);
    expect(
      computePrice(5900, [discount({ startsAt: at("2026-10-11T00:00:00Z") })], now).finalCents,
    ).toBe(5900);
    expect(computePrice(5900, [discount({ endsAt: now })], now).finalCents).toBe(5900);
    expect(computePrice(5900, [discount({ startsAt: now })], now).finalCents).toBe(2950);
  });

  it("several active discounts → lowest price; tie → most recent", () => {
    const a = discount({ id: "a", type: "percent", value: 10 });
    const b = discount({ id: "b", type: "amount", value: 3000 });
    expect(computePrice(5900, [a, b], now).discount?.id).toBe("b");

    const c = discount({ id: "c", value: 50, startsAt: at("2026-10-05T00:00:00Z") });
    const d = discount({ id: "d", value: 50, startsAt: at("2026-10-01T00:00:00Z") });
    expect(computePrice(5900, [d, c], now).discount?.id).toBe("c");
  });

  it("reproduces the current site prices with amount discounts", () => {
    const cases: Array<[number, number, number]> = [
      [6084, 3084, 3000], // Пробна 60,84 → 30
      [11900, 6000, 5900], // Единична 119 → 59
      [41057, 20557, 20500], // 5+1 410,57 → 205
      [73217, 36617, 36600], // 10+2 732,17 → 366
      [106656, 53656, 53000], // 20 1066,56 → 530
    ];
    for (const [base, off, expected] of cases) {
      expect(computePrice(base, [discount({ type: "amount", value: off })], now).finalCents).toBe(
        expected,
      );
    }
  });

  it("snapshot round-trips", () => {
    const d = discount({ endsAt: at("2026-11-01T00:00:00Z") });
    expect(fromDiscountSnapshot(toDiscountSnapshot(d))).toEqual(d);
  });
});

describe("perSessionCents", () => {
  it("matches the published per-procedure prices", () => {
    expect(perSessionCents(20500, 6)).toBe(3417); // 34,17 €
    expect(perSessionCents(36600, 12)).toBe(3050); // 30,50 €
    expect(perSessionCents(53000, 20)).toBe(2650); // 26,50 €
  });

  it("rounds half-up and validates input", () => {
    expect(perSessionCents(5, 2)).toBe(3); // 2.5 → 3
    expect(() => perSessionCents(100, 0)).toThrow(RangeError);
  });
});

describe("formatting", () => {
  it("formats euros in Bulgarian style", () => {
    expect(formatEur(3000)).toBe(`30${NBSP}€`);
    expect(formatEur(6084)).toBe(`60,84${NBSP}€`);
    expect(formatEur(106656)).toBe(`1066,56${NBSP}€`);
    expect(formatEur(3050)).toBe(`30,50${NBSP}€`);
  });

  it("converts to BGN at the fixed rate, half-up", () => {
    expect(eurCentsToBgnStotinki(3000)).toBe(5867); // 58,6749
    expect(eurCentsToBgnStotinki(53000)).toBe(103659); // 1036,5899
    expect(eurCentsToBgnStotinki(100)).toBe(196); // 1,95583
    expect(formatBgn(5867)).toBe(`58,67${NBSP}лв.`);
  });
});

describe("prior-price rule (30 days)", () => {
  const start = at("2026-11-01T00:00:00Z");
  const daysBefore = (n: number) => new Date(start.getTime() - n * DAY);

  it("ok when the usual price was applied for the whole 30 days", () => {
    const states: PriceState[] = [{ changedAt: daysBefore(60), baseCents: 11900, discounts: [] }];
    expect(checkPriorPrice(states, start, 11900)).toEqual({ ok: true, issue: null, lowestCents: 11900 });
  });

  it("warns when history is shorter than 30 days (e.g. freshly seeded prices)", () => {
    const states: PriceState[] = [{ changedAt: daysBefore(5), baseCents: 11900, discounts: [] }];
    expect(checkPriorPrice(states, start, 11900)).toMatchObject({
      ok: false,
      issue: "insufficient_history",
    });
  });

  it("warns when a lower price was applied inside the window (standing discount)", () => {
    const standing = discount({ type: "amount", value: 6000, startsAt: daysBefore(400), endsAt: null });
    const states: PriceState[] = [{ changedAt: daysBefore(400), baseCents: 11900, discounts: [standing] }];
    expect(checkPriorPrice(states, start, 11900)).toEqual({
      ok: false,
      issue: "lower_price_in_window",
      lowestCents: 5900,
    });
  });

  it("catches a short discount that ended inside the window", () => {
    const flash = discount({ type: "percent", value: 20, startsAt: daysBefore(20), endsAt: daysBefore(18) });
    const states: PriceState[] = [{ changedAt: daysBefore(90), baseCents: 10000, discounts: [flash] }];
    expect(checkPriorPrice(states, start, 10000)).toMatchObject({ ok: false, lowestCents: 8000 });
  });

  it("a base-price increase inside the window lowers the allowed prior price", () => {
    const states: PriceState[] = [
      { changedAt: daysBefore(90), baseCents: 9000, discounts: [] },
      { changedAt: daysBefore(10), baseCents: 12000, discounts: [] },
    ];
    expect(checkPriorPrice(states, start, 12000)).toMatchObject({ ok: false, lowestCents: 9000 });
    expect(checkPriorPrice(states, start, 9000).ok).toBe(true);
  });

  it("effectivePriceAt is null before history and follows later states", () => {
    const states: PriceState[] = [
      { changedAt: daysBefore(10), baseCents: 12000, discounts: [] },
      { changedAt: daysBefore(90), baseCents: 9000, discounts: [] },
    ];
    expect(effectivePriceAt(states, daysBefore(100))).toBeNull();
    expect(effectivePriceAt(states, daysBefore(50))).toBe(9000);
    expect(effectivePriceAt(states, daysBefore(1))).toBe(12000);
    expect(lowestEffectivePrice(states, daysBefore(30), start)).toEqual({
      lowestCents: 9000,
      coversWholeWindow: true,
    });
  });
});

describe("promoDiscountedCents", () => {
  it("takes the partner's percent off the current price, half-up to the cent", () => {
    expect(promoDiscountedCents(3000, 15)).toBe(2550); // Пробна 30 € → 25,50 €
    expect(promoDiscountedCents(20500, 20)).toBe(16400); // Пакет 5 205 € → 164 €
    expect(promoDiscountedCents(36600, 20)).toBe(29280); // Пакет 10 366 € → 292,80 €
    expect(promoDiscountedCents(999, 15)).toBe(849); // 149,85 cents off → 150 (half-up)
  });
});
