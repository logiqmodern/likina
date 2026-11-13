import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  artists,
  artworkImages,
  artworks,
  orderCounters,
  orderItems,
  orders,
  payments,
  type DeliveryDetails,
  type InvoiceDetails,
} from "@/db/schema";
import {
  assertTransition,
  formatOrderNumber,
  holdsStock,
  initialStatus,
  timestampFor,
  type DeliveryMethod,
  type OrderStatus,
  type PaymentMethod,
} from "@/domain/orders";
import { quoteOrder } from "@/domain/pricing";
import type { Settings } from "@/domain/settings";
import { APP_TIME_ZONE } from "@/lib/env";
import { writeAudit } from "@/server/admin/audit";
import { generateManageToken } from "@/server/crypto";
import { PG, pgCode } from "@/server/pg-errors";

/*
 * Orders and stock (docs/PROMPT.md §5.2–5.3).
 *
 * Invariants:
 * - An original is in at most one active order: the artworks are locked with
 *   SELECT … FOR UPDATE inside the order transaction, and the partial unique
 *   index order_items_one_active_original_uq backs this up in the database.
 * - Card payment: the artworks are `reserved` until `expires_at`; success →
 *   `sold`; failure or expiry → back to `available`.
 * - Pay later (cash on delivery / at the atelier): `sold` immediately.
 * - Prints: stock is decremented in the same transaction and restored on release.
 */

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Executor = Database | Tx;

export interface CheckoutInput {
  items: Array<{ artworkId: string; qty: number }>;
  customerName: string;
  email: string;
  phone: string;
  deliveryMethod: DeliveryMethod;
  delivery: DeliveryDetails;
  paymentMethod: PaymentMethod;
  locale: "bg" | "en";
  invoice?: InvoiceDetails | null;
  notesClient?: string | null;
  marketingConsent: boolean;
  attribution?: Record<string, string>;
}

export type CreateOrderResult =
  | { ok: true; orderId: string; number: string; token: string; status: OrderStatus; totalCents: number }
  | { ok: false; reason: "unavailable"; artworkIds: string[] }
  | { ok: false; reason: "invalid"; message: string };

/** The calendar year in Sofia (order numbers restart every year). */
export function sofiaYear(at: Date): number {
  return Number(new Intl.DateTimeFormat("en", { timeZone: APP_TIME_ZONE, year: "numeric" }).format(at));
}

function paymentFitsDelivery(payment: PaymentMethod, delivery: DeliveryMethod): boolean {
  if (payment === "cod") return delivery !== "pickup";
  if (payment === "on_pickup") return delivery === "pickup";
  return true;
}

/** Merge duplicate lines and drop anything that is not a positive integer quantity. */
function normalizeItems(items: CheckoutInput["items"]): Array<{ artworkId: string; qty: number }> {
  const byId = new Map<string, number>();
  for (const { artworkId, qty } of items) {
    if (!Number.isInteger(qty) || qty < 1) continue;
    byId.set(artworkId, (byId.get(artworkId) ?? 0) + qty);
  }
  return [...byId].map(([artworkId, qty]) => ({ artworkId, qty }));
}

class Unavailable extends Error {
  constructor(public readonly artworkIds: string[]) {
    super("unavailable");
  }
}

/**
 * Creates an order and takes its artworks (reserved for card, sold for pay later).
 * Never sells an original twice: concurrent attempts for the same artwork are
 * serialized by the row lock, and the loser gets `unavailable`.
 */
export async function createOrder(
  db: Database,
  input: CheckoutInput,
  settings: Pick<Settings, "reservationMinutes" | "pickupDiscountPercent" | "shippingModel">,
  now: Date = new Date(),
): Promise<CreateOrderResult> {
  const items = normalizeItems(input.items);
  if (items.length === 0) return { ok: false, reason: "invalid", message: "empty cart" };
  if (!paymentFitsDelivery(input.paymentMethod, input.deliveryMethod)) {
    return { ok: false, reason: "invalid", message: "payment method does not fit the delivery method" };
  }

  // Free artworks whose card reservation has run out, so they can be bought again.
  await releaseExpiredReservations(db, now);

  const { token, hash } = generateManageToken();
  const status = initialStatus(input.paymentMethod);

  try {
    return await db.transaction(async (tx) => {
      const ids = items.map((i) => i.artworkId).sort();
      // Lock in a fixed order (by id) so two carts with the same artworks cannot deadlock.
      const rows = await tx
        .select({
          id: artworks.id,
          kind: artworks.kind,
          status: artworks.status,
          stock: artworks.stock,
          priceCents: artworks.priceCents,
          titleBg: artworks.titleBg,
          titleEn: artworks.titleEn,
          artistName: artists.nameBg,
        })
        .from(artworks)
        .leftJoin(artists, eq(artists.id, artworks.artistId))
        .where(inArray(artworks.id, ids))
        .orderBy(asc(artworks.id))
        .for("update", { of: artworks });

      const byId = new Map(rows.map((r) => [r.id, r]));
      const unavailable: string[] = [];
      for (const { artworkId, qty } of items) {
        const a = byId.get(artworkId);
        const ok =
          a !== undefined &&
          a.status === "available" &&
          a.priceCents !== null &&
          a.kind !== "custom_sample" &&
          (a.kind === "original" ? qty === 1 : a.stock >= qty);
        if (!ok) unavailable.push(artworkId);
      }
      if (unavailable.length) throw new Unavailable(unavailable);

      const lines = items.map(({ artworkId, qty }) => ({ artworkId, qty, art: byId.get(artworkId)! }));
      const quote = quoteOrder(
        lines.map((l) => ({ unitPriceCents: l.art.priceCents!, qty: l.qty })),
        input.deliveryMethod,
        settings,
      );

      const [counter] = await tx
        .insert(orderCounters)
        .values({ year: sofiaYear(now), last: 1 })
        .onConflictDoUpdate({ target: orderCounters.year, set: { last: sql`${orderCounters.last} + 1` } })
        .returning({ last: orderCounters.last });
      const number = formatOrderNumber(sofiaYear(now), counter!.last);

      const [order] = await tx
        .insert(orders)
        .values({
          number,
          status,
          locale: input.locale,
          customerName: input.customerName.trim(),
          email: input.email.trim().toLowerCase(),
          phone: input.phone.trim(),
          deliveryMethod: input.deliveryMethod,
          delivery: input.delivery,
          paymentMethod: input.paymentMethod,
          subtotalCents: quote.subtotalCents,
          discountCents: quote.discountCents,
          shippingCents: quote.shippingCents,
          totalCents: quote.totalCents,
          pricingSnapshot: quote.snapshot,
          invoice: input.invoice ?? null,
          notesClient: input.notesClient?.trim() || null,
          marketingConsent: input.marketingConsent,
          termsAcceptedAt: now,
          attribution: input.attribution ?? {},
          manageTokenHash: hash,
          expiresAt: status === "pending_payment" ? new Date(now.getTime() + settings.reservationMinutes * 60_000) : null,
          createdAt: now,
        })
        .returning({ id: orders.id });

      const covers = await tx
        .select({ artworkId: artworkImages.artworkId, mediaId: artworkImages.mediaId })
        .from(artworkImages)
        .where(and(inArray(artworkImages.artworkId, ids), eq(artworkImages.sortOrder, 0)));
      const coverOf = new Map(covers.map((c) => [c.artworkId, c.mediaId]));

      await tx.insert(orderItems).values(
        lines.map((l) => ({
          orderId: order!.id,
          artworkId: l.artworkId,
          kind: l.art.kind,
          titleBg: l.art.titleBg,
          titleEn: l.art.titleEn,
          artistName: l.art.artistName,
          imageMediaId: coverOf.get(l.artworkId) ?? null,
          qty: l.qty,
          unitPriceCents: l.art.priceCents!,
          lineTotalCents: l.art.priceCents! * l.qty,
          holdsStock: true,
        })),
      );

      for (const l of lines) await takeStock(tx, l.artworkId, l.art.kind, l.qty, status === "pending_payment" ? "reserved" : "sold", now);

      return { ok: true as const, orderId: order!.id, number, token, status, totalCents: quote.totalCents };
    });
  } catch (error) {
    if (error instanceof Unavailable) return { ok: false, reason: "unavailable", artworkIds: error.artworkIds };
    // The partial unique index caught a second active order for an original.
    if (pgCode(error) === PG.uniqueViolation) return { ok: false, reason: "unavailable", artworkIds: items.map((i) => i.artworkId) };
    throw error;
  }
}

/** Originals: reserved/sold. Prints: stock − qty (sold out at 0). */
async function takeStock(
  tx: Executor,
  artworkId: string,
  kind: "original" | "print" | "custom_sample",
  qty: number,
  as: "reserved" | "sold",
  now: Date,
): Promise<void> {
  if (kind === "original") {
    await tx
      .update(artworks)
      .set({ status: as, soldAt: as === "sold" ? now : null })
      .where(eq(artworks.id, artworkId));
    return;
  }
  await tx
    .update(artworks)
    .set({
      stock: sql`${artworks.stock} - ${qty}`,
      status: sql`CASE WHEN ${artworks.stock} - ${qty} <= 0 THEN 'sold'::artwork_status ELSE ${artworks.status} END`,
      soldAt: sql`CASE WHEN ${artworks.stock} - ${qty} <= 0 THEN ${now.toISOString()}::timestamptz ELSE ${artworks.soldAt} END`,
    })
    .where(eq(artworks.id, artworkId));
}

/**
 * Gives an order's artworks back. After a shipment went out (returned), the
 * original comes back `hidden`, so the atelier checks it before it is for sale again.
 */
async function releaseStock(tx: Executor, orderId: string, fromStatus: OrderStatus): Promise<void> {
  const held = await tx
    .update(orderItems)
    .set({ holdsStock: false })
    .where(and(eq(orderItems.orderId, orderId), eq(orderItems.holdsStock, true)))
    .returning({ artworkId: orderItems.artworkId, kind: orderItems.kind, qty: orderItems.qty });

  const leftTheAtelier = fromStatus === "shipped" || fromStatus === "delivered" || fromStatus === "completed";
  for (const item of held) {
    if (item.kind === "original") {
      await tx
        .update(artworks)
        .set({ status: leftTheAtelier ? "hidden" : "available", soldAt: null })
        .where(and(eq(artworks.id, item.artworkId), inArray(artworks.status, ["reserved", "sold"])));
    } else {
      await tx
        .update(artworks)
        .set({
          stock: sql`${artworks.stock} + ${item.qty}`,
          status: sql`CASE WHEN ${artworks.status} = 'sold' THEN 'available'::artwork_status ELSE ${artworks.status} END`,
          soldAt: null,
        })
        .where(eq(artworks.id, item.artworkId));
    }
  }
}

/** Re-takes the stock of a failed card order (a late successful payment). False if something was sold meanwhile. */
async function retakeStock(tx: Tx, orderId: string, now: Date): Promise<boolean> {
  const items = await tx
    .select({ artworkId: orderItems.artworkId, kind: orderItems.kind, qty: orderItems.qty })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.artworkId));
  const ids = items.map((i) => i.artworkId);
  const rows = await tx
    .select({ id: artworks.id, status: artworks.status, stock: artworks.stock })
    .from(artworks)
    .where(inArray(artworks.id, ids))
    .orderBy(asc(artworks.id))
    .for("update");
  const byId = new Map(rows.map((r) => [r.id, r]));
  const free = items.every((i) => {
    const a = byId.get(i.artworkId);
    return a?.status === "available" && (i.kind === "original" || a.stock >= i.qty);
  });
  if (!free) return false;
  await tx.update(orderItems).set({ holdsStock: true }).where(eq(orderItems.orderId, orderId));
  for (const i of items) await takeStock(tx, i.artworkId, i.kind, i.qty, "sold", now);
  return true;
}

export type PaymentOutcome =
  | { kind: "duplicate" }
  | { kind: "paid"; orderId: string }
  | { kind: "already_paid"; orderId: string }
  | { kind: "failed"; orderId: string }
  | { kind: "ignored"; orderId: string; status: OrderStatus }
  /** money was taken but the order could not be fulfilled — refund needed (alert the studio) */
  | { kind: "needs_refund"; orderId: string; reason: "amount_mismatch" | "sold_meanwhile" | "order_closed" }
  | { kind: "unknown_order" };

/**
 * Records a payment result for an order (myPOS notification, §6.4).
 * Idempotent: the same provider reference is processed once.
 */
export async function recordPaymentResult(
  db: Database,
  input: {
    orderNumber: string;
    providerRef: string;
    amountCents: number;
    result: "succeeded" | "failed" | "cancelled";
    raw?: Record<string, unknown>;
  },
  now: Date = new Date(),
): Promise<PaymentOutcome> {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select({ id: orders.id, status: orders.status, totalCents: orders.totalCents, paymentMethod: orders.paymentMethod, deliveryMethod: orders.deliveryMethod })
      .from(orders)
      .where(eq(orders.number, input.orderNumber))
      .for("update");
    if (!order) return { kind: "unknown_order" as const };

    const inserted = await tx
      .insert(payments)
      .values({
        orderId: order.id,
        provider: "mypos",
        kind: "payment",
        providerRef: input.providerRef,
        amountCents: input.amountCents,
        result: input.result,
        raw: input.raw ?? null,
        createdBy: "mypos",
        createdAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: payments.id });
    if (inserted.length === 0) return { kind: "duplicate" as const };

    if (input.result !== "succeeded") {
      if (order.status !== "pending_payment") return { kind: "ignored" as const, orderId: order.id, status: order.status };
      await setStatus(tx, order, "payment_failed", "mypos", now);
      return { kind: "failed" as const, orderId: order.id };
    }

    if (input.amountCents !== order.totalCents) {
      await writeAudit(tx, {
        actor: "mypos",
        action: "order.payment_amount_mismatch",
        entity: "order",
        entityId: order.id,
        diff: { expected: order.totalCents, received: input.amountCents },
      });
      return { kind: "needs_refund" as const, orderId: order.id, reason: "amount_mismatch" as const };
    }

    if (order.status === "pending_payment") {
      await setStatus(tx, order, "paid", "mypos", now);
      await markItemsSold(tx, order.id, now);
      return { kind: "paid" as const, orderId: order.id };
    }
    if (order.status === "payment_failed") {
      if (!(await retakeStock(tx, order.id, now))) {
        return { kind: "needs_refund" as const, orderId: order.id, reason: "sold_meanwhile" as const };
      }
      await setStatus(tx, order, "paid", "mypos", now);
      return { kind: "paid" as const, orderId: order.id };
    }
    if (order.status === "cancelled") return { kind: "needs_refund" as const, orderId: order.id, reason: "order_closed" as const };
    return { kind: "already_paid" as const, orderId: order.id };
  });
}

/** Reserved originals of a paid order become sold (prints were already counted). */
async function markItemsSold(tx: Tx, orderId: string, now: Date): Promise<void> {
  const ids = (
    await tx
      .select({ artworkId: orderItems.artworkId })
      .from(orderItems)
      .where(and(eq(orderItems.orderId, orderId), eq(orderItems.kind, "original")))
  ).map((r) => r.artworkId);
  if (ids.length === 0) return;
  await tx
    .update(artworks)
    .set({ status: "sold", soldAt: now })
    .where(and(inArray(artworks.id, ids), eq(artworks.status, "reserved")));
}

async function setStatus(
  tx: Tx,
  order: { id: string; status: OrderStatus; paymentMethod: PaymentMethod; deliveryMethod: DeliveryMethod },
  to: OrderStatus,
  actor: string,
  now: Date,
): Promise<void> {
  assertTransition(order, to);
  const column = timestampFor(to);
  await tx
    .update(orders)
    .set({
      status: to,
      ...(column ? { [column]: now } : {}),
      ...(to !== "pending_payment" ? { expiresAt: null } : {}),
    })
    .where(eq(orders.id, order.id));
  if (holdsStock(order.status) && !holdsStock(to)) await releaseStock(tx, order.id, order.status);
  await writeAudit(tx, { actor, action: `order.${to}`, entity: "order", entityId: order.id, diff: { from: order.status, to } });
}

/**
 * Admin (or system) status change, e.g. shipped / delivered / cancelled.
 * Throws OrderTransitionError for a step the rules do not allow.
 */
export async function transitionOrder(db: Database, orderId: string, to: OrderStatus, actor: string, now: Date = new Date()): Promise<void> {
  await db.transaction(async (tx) => {
    const [order] = await tx
      .select({ id: orders.id, status: orders.status, paymentMethod: orders.paymentMethod, deliveryMethod: orders.deliveryMethod })
      .from(orders)
      .where(eq(orders.id, orderId))
      .for("update");
    if (!order) throw new Error(`order ${orderId} not found`);
    if (to === "paid") throw new Error("orders become paid only through a payment");
    await setStatus(tx, order, to, actor, now);
  });
}

/**
 * Card reservations that ran out: order → payment_failed, artworks → available
 * (§5.3). Safe to run from several places at once (SKIP LOCKED).
 * Returns the affected order ids (for the "try again" e-mail).
 */
export async function releaseExpiredReservations(db: Database, now: Date = new Date()): Promise<string[]> {
  return db.transaction(async (tx) => {
    const due = await tx
      .select({ id: orders.id, status: orders.status, paymentMethod: orders.paymentMethod, deliveryMethod: orders.deliveryMethod })
      .from(orders)
      .where(and(eq(orders.status, "pending_payment"), lte(orders.expiresAt, now)))
      .for("update", { skipLocked: true });
    for (const order of due) await setStatus(tx, order, "payment_failed", "system", now);
    return due.map((o) => o.id);
  });
}

export class SoldOfflineError extends Error {
  constructor(public readonly code: "not_found" | "in_order" | "already_sold" | "not_original") {
    super(code);
    this.name = "SoldOfflineError";
  }
}

/** "Маркирай като продадена" — an original sold outside the site (§10.2). Refuses while it is in an active order. */
export async function markSoldOffline(db: Database, artworkId: string, actor: string, now: Date = new Date()): Promise<void> {
  await db.transaction(async (tx) => {
    const [a] = await tx
      .select({ id: artworks.id, status: artworks.status, kind: artworks.kind })
      .from(artworks)
      .where(eq(artworks.id, artworkId))
      .for("update");
    if (!a) throw new SoldOfflineError("not_found");
    // prints: the admin lowers the stock instead
    if (a.kind !== "original") throw new SoldOfflineError("not_original");
    if (a.status === "sold") throw new SoldOfflineError("already_sold");
    const [active] = await tx
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(and(eq(orderItems.artworkId, artworkId), eq(orderItems.holdsStock, true)))
      .limit(1);
    if (active || a.status === "reserved") throw new SoldOfflineError("in_order");
    await tx.update(artworks).set({ status: "sold", soldAt: now, soldOffline: true }).where(eq(artworks.id, artworkId));
    await writeAudit(tx, { actor, action: "artwork.sold_offline", entity: "artwork", entityId: artworkId, diff: { from: a.status } });
  });
}
