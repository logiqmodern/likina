/**
 * Pricing — the single place where prices are computed (docs/PROMPT.md §10.3).
 * All amounts are integer euro cents; rounding is half-up to the cent using
 * integer arithmetic only.
 */

export type DiscountType = "percent" | "amount";

export interface Discount {
  id: string;
  type: DiscountType;
  /** percent: whole percent 1–100; amount: euro cents */
  value: number;
  label: string | null;
  startsAt: Date;
  endsAt: Date | null; // exclusive
  isActive: boolean;
}

/** JSON-safe form stored in price_history / bookings. */
export interface DiscountSnapshot {
  id: string;
  type: DiscountType;
  value: number;
  label: string | null;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
}

export interface PriceQuote {
  baseCents: number;
  finalCents: number;
  savingsCents: number;
  /** rounded percent actually saved, for display checks (label may differ) */
  percentOff: number;
  discount: DiscountSnapshot | null;
}

export const EUR_BGN_RATE = 1.95583;

export function toDiscountSnapshot(d: Discount): DiscountSnapshot {
  return {
    id: d.id,
    type: d.type,
    value: d.value,
    label: d.label,
    startsAt: d.startsAt.toISOString(),
    endsAt: d.endsAt ? d.endsAt.toISOString() : null,
    isActive: d.isActive,
  };
}

export function fromDiscountSnapshot(s: DiscountSnapshot): Discount {
  return {
    ...s,
    startsAt: new Date(s.startsAt),
    endsAt: s.endsAt ? new Date(s.endsAt) : null,
  };
}

function assertCents(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer number of cents, got ${value}`);
  }
}

export function isDiscountActiveAt(d: Discount, at: Date): boolean {
  if (!d.isActive) return false;
  const t = at.getTime();
  if (t < d.startsAt.getTime()) return false;
  if (d.endsAt && t >= d.endsAt.getTime()) return false;
  return true;
}

/** Price after one discount, never below zero. */
export function applyDiscount(baseCents: number, d: Pick<Discount, "type" | "value">): number {
  assertCents(baseCents, "baseCents");
  if (d.type === "percent") {
    if (!Number.isInteger(d.value) || d.value < 1 || d.value > 100) {
      throw new RangeError(`percent discount must be 1–100, got ${d.value}`);
    }
    // half-up: floor((base * pct + 50) / 100)
    const off = Math.floor((baseCents * d.value + 50) / 100);
    return Math.max(0, baseCents - off);
  }
  assertCents(d.value, "amount discount");
  return Math.max(0, baseCents - d.value);
}

/**
 * Effective price at an instant. When several discounts are active at once,
 * the customer gets the lowest price (ties: the most recently started one).
 */
export function computePrice(baseCents: number, discounts: Discount[], at: Date): PriceQuote {
  assertCents(baseCents, "baseCents");
  let best: { final: number; discount: Discount } | null = null;

  for (const d of discounts) {
    if (!isDiscountActiveAt(d, at)) continue;
    const final = applyDiscount(baseCents, d);
    if (
      !best ||
      final < best.final ||
      (final === best.final && d.startsAt.getTime() > best.discount.startsAt.getTime())
    ) {
      best = { final, discount: d };
    }
  }

  const finalCents = best ? best.final : baseCents;
  const savingsCents = baseCents - finalCents;
  return {
    baseCents,
    finalCents,
    savingsCents,
    percentOff: baseCents === 0 ? 0 : Math.floor((savingsCents * 100 * 2 + baseCents) / (baseCents * 2)),
    discount: best ? toDiscountSnapshot(best.discount) : null,
  };
}

/** Price per procedure in a package, half-up to the cent. */
export function perSessionCents(totalCents: number, sessions: number): number {
  assertCents(totalCents, "totalCents");
  if (!Number.isInteger(sessions) || sessions < 1) {
    throw new RangeError(`sessions must be a positive integer, got ${sessions}`);
  }
  return Math.floor((2 * totalCents + sessions) / (2 * sessions));
}

/** EUR cents → BGN stotinki at the fixed rate, half-up. */
export function eurCentsToBgnStotinki(cents: number): number {
  assertCents(cents, "cents");
  return Math.floor((cents * 195_583 + 50_000) / 100_000);
}

const NBSP = " ";

function formatAmount(minor: number): string {
  const whole = minor % 100 === 0;
  return new Intl.NumberFormat("bg-BG", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

/** "30 €", "60,84 €", "1066,56 €" — whole euros drop the decimals. */
export function formatEur(cents: number): string {
  assertCents(cents, "cents");
  return `${formatAmount(cents)}${NBSP}€`;
}

export function formatBgn(stotinki: number): string {
  assertCents(stotinki, "stotinki");
  return `${formatAmount(stotinki)}${NBSP}лв.`;
}

// ── Prior-price rule (Omnibus / ЗЗП) ─────────────────────

/** Pricing state from `changedAt` on — one price_history row. */
export interface PriceState {
  changedAt: Date;
  baseCents: number;
  discounts: Discount[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function sortStates(states: PriceState[]): PriceState[] {
  return [...states].sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());
}

/** Effective price at `at`, or null if there is no history yet at that instant. */
export function effectivePriceAt(states: PriceState[], at: Date): number | null {
  let current: PriceState | null = null;
  for (const s of sortStates(states)) {
    if (s.changedAt.getTime() <= at.getTime()) current = s;
    else break;
  }
  return current ? computePrice(current.baseCents, current.discounts, at).finalCents : null;
}

/**
 * Lowest effective price in [from, to). The price is piecewise constant and
 * right-continuous, so evaluating at every change point inside the window is exact.
 */
export function lowestEffectivePrice(
  states: PriceState[],
  from: Date,
  to: Date,
): { lowestCents: number | null; coversWholeWindow: boolean } {
  const f = from.getTime();
  const t = to.getTime();
  const points = new Set<number>([f]);
  const inside = (ms: number) => ms > f && ms < t;

  for (const s of states) {
    if (inside(s.changedAt.getTime())) points.add(s.changedAt.getTime());
    for (const d of s.discounts) {
      if (inside(d.startsAt.getTime())) points.add(d.startsAt.getTime());
      if (d.endsAt && inside(d.endsAt.getTime())) points.add(d.endsAt.getTime());
    }
  }

  let lowest: number | null = null;
  for (const p of points) {
    const price = effectivePriceAt(states, new Date(p));
    if (price !== null && (lowest === null || price < lowest)) lowest = price;
  }

  const first = sortStates(states)[0];
  return { lowestCents: lowest, coversWholeWindow: !!first && first.changedAt.getTime() <= f };
}

export type PriorPriceIssue = "insufficient_history" | "lower_price_in_window";

/**
 * Checks whether the struck-through "usual" price may be shown for a discount
 * starting at `discountStartsAt`: it must not exceed the lowest price actually
 * applied in the preceding `days` days. Advisory only — the admin shows a
 * warning, it never blocks (§10.3).
 */
export function checkPriorPrice(
  states: PriceState[],
  discountStartsAt: Date,
  displayedPriorCents: number,
  days = 30,
): { ok: boolean; issue: PriorPriceIssue | null; lowestCents: number | null } {
  const from = new Date(discountStartsAt.getTime() - days * DAY_MS);
  const { lowestCents, coversWholeWindow } = lowestEffectivePrice(states, from, discountStartsAt);

  if (!coversWholeWindow || lowestCents === null) {
    return { ok: false, issue: "insufficient_history", lowestCents };
  }
  if (lowestCents < displayedPriorCents) {
    return { ok: false, issue: "lower_price_in_window", lowestCents };
  }
  return { ok: true, issue: null, lowestCents };
}

/** Price with a partner's discount code (whole percent, half-up), on top of the current price. */
export function promoDiscountedCents(priceCents: number, percent: number): number {
  return applyDiscount(priceCents, { type: "percent", value: percent });
}
