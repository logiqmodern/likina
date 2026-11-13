/**
 * Pricing — the single place where shop prices are computed (docs/PROMPT.md §5.4).
 *
 * All amounts are integer euro cents; rounding is half-up to the cent using
 * integer arithmetic only. The result is snapshotted on the order, so a later
 * change of a setting never changes an existing order.
 */

export type ShippingModel = "included";
export type DeliveryMethod = "econt_office" | "econt_address" | "econt_locker" | "pickup";

export interface PricingSettings {
  /** discount for picking the order up from the atelier, whole percent 0–50 */
  pickupDiscountPercent: number;
  /** §6.3: shipping is included in the artwork price (client decision 03.11.2026) */
  shippingModel: ShippingModel;
}

export interface CartLine {
  unitPriceCents: number;
  qty: number;
}

export interface OrderQuote {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  /** what the quote was computed from — stored on the order */
  snapshot: {
    deliveryMethod: DeliveryMethod;
    pickupDiscountPercent: number;
    shippingModel: ShippingModel;
  };
}

function assertCents(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer number of cents, got ${value}`);
  }
}

/** `percent` of `cents`, half-up to the cent. */
export function percentOf(cents: number, percent: number): number {
  assertCents(cents, "cents");
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw new RangeError(`percent must be an integer 0–100, got ${percent}`);
  }
  return Math.floor((cents * percent + 50) / 100);
}

export function lineTotalCents(line: CartLine): number {
  assertCents(line.unitPriceCents, "unitPriceCents");
  if (!Number.isInteger(line.qty) || line.qty < 1) throw new RangeError(`qty must be ≥ 1, got ${line.qty}`);
  return line.unitPriceCents * line.qty;
}

/** Shipping cost for a delivery method. Never throws for a valid method: shipping must never block checkout (§6.3). */
export function shippingCents(_method: DeliveryMethod, model: ShippingModel): number {
  switch (model) {
    case "included":
      return 0;
  }
}

/** The order total: subtotal − pickup discount + shipping. */
export function quoteOrder(lines: CartLine[], deliveryMethod: DeliveryMethod, settings: PricingSettings): OrderQuote {
  if (lines.length === 0) throw new RangeError("an order needs at least one line");
  const subtotalCents = lines.reduce((sum, l) => sum + lineTotalCents(l), 0);
  const discountCents = deliveryMethod === "pickup" ? percentOf(subtotalCents, settings.pickupDiscountPercent) : 0;
  const ship = shippingCents(deliveryMethod, settings.shippingModel);
  return {
    subtotalCents,
    discountCents,
    shippingCents: ship,
    totalCents: subtotalCents - discountCents + ship,
    snapshot: {
      deliveryMethod,
      pickupDiscountPercent: settings.pickupDiscountPercent,
      shippingModel: settings.shippingModel,
    },
  };
}

/** Parses an admin-entered euro amount ("450", "450,50", "1 450.5") into cents; null if invalid. */
export function parseEurToCents(input: string): number | null {
  const s = input.replace(/[\s €]/g, "").replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

const NBSP = " ";

/** "450 €", "60,84 €", "1 450 €" — whole euros drop the decimals. */
export function formatEur(cents: number, locale: "bg" | "en" = "bg"): string {
  assertCents(cents, "cents");
  const whole = cents % 100 === 0;
  const amount = new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-IE", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  return locale === "bg" ? `${amount}${NBSP}€` : `€${amount}`;
}

// ── Prior-price rule (Omnibus / ЗЗП, §5.4) ───────────────

export interface PricePoint {
  changedAt: Date;
  /** null = no price at that time */
  priceCents: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Lowest price in the 30 days before `at` (exclusive) — `at` is the moment the
 * reduction takes effect, so the reduced price itself is not counted. This is
 * the reference for a crossed-out price. Considers the price in force at the
 * start of the window and every change inside it; null if there was none.
 */
export function lowestPriceLast30Days(history: PricePoint[], at: Date): number | null {
  const from = at.getTime() - 30 * DAY_MS;
  const sorted = [...history].sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());
  let inForceAtStart: number | null = null;
  const candidates: number[] = [];
  for (const p of sorted) {
    const t = p.changedAt.getTime();
    if (t <= from) inForceAtStart = p.priceCents;
    else if (t < at.getTime() && p.priceCents !== null) candidates.push(p.priceCents);
  }
  if (inForceAtStart !== null) candidates.push(inForceAtStart);
  return candidates.length ? Math.min(...candidates) : null;
}

/**
 * Warning for the admin when a crossed-out price is not the lowest price of
 * the last 30 days (§5.4). Returns null when everything is fine.
 */
export function compareAtWarning(
  compareAtCents: number | null,
  priceCents: number | null,
  lowest30: number | null,
): "compare_not_higher" | "compare_not_lowest_30d" | null {
  if (compareAtCents === null || priceCents === null) return null;
  if (compareAtCents <= priceCents) return "compare_not_higher";
  if (lowest30 !== null && compareAtCents > lowest30) return "compare_not_lowest_30d";
  return null;
}
