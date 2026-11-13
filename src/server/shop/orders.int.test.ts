import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { artworks, orderItems, orders, payments } from "@/db/schema";
import { DEFAULT_SETTINGS } from "@/domain/settings";
import { createTestDb, hasDatabase, resetDb } from "@/test/db";
import {
  createOrder,
  markSoldOffline,
  recordPaymentResult,
  releaseExpiredReservations,
  SoldOfflineError,
  transitionOrder,
  type CheckoutInput,
} from "./orders";

describe.skipIf(!hasDatabase)("orders and stock (Postgres)", () => {
  const { db, pool } = hasDatabase ? createTestDb() : ({} as ReturnType<typeof createTestDb>);
  const settings = DEFAULT_SETTINGS;
  const t0 = new Date("2026-11-13T10:00:00Z");

  beforeEach(async () => {
    await resetDb(db);
  });

  afterAll(async () => {
    await pool?.end();
  });

  let seq = 0;
  async function artwork(over: Partial<typeof artworks.$inferInsert> = {}): Promise<string> {
    seq++;
    const [row] = await db
      .insert(artworks)
      .values({ slug: `a-${seq}`, slugEn: `a-${seq}-en`, titleBg: `Творба ${seq}`, status: "available", priceCents: 45_000, ...over })
      .returning({ id: artworks.id });
    return row!.id;
  }

  function checkout(over: Partial<CheckoutInput> & Pick<CheckoutInput, "items">): CheckoutInput {
    return {
      customerName: "Мария Петрова",
      email: "Maria@Example.com",
      phone: "+359887123456",
      deliveryMethod: "econt_office",
      delivery: { city: "София", officeName: "Офис Лозенец" },
      paymentMethod: "mypos",
      locale: "bg",
      marketingConsent: false,
      ...over,
    };
  }

  const statusOf = async (id: string) => (await db.select({ s: artworks.status }).from(artworks).where(eq(artworks.id, id)))[0]!.s;
  const orderOf = async (id: string) => (await db.select().from(orders).where(eq(orders.id, id)))[0]!;

  it("20 parallel card checkouts for one original → exactly 1 succeeds", async () => {
    const id = await artwork();
    const results = await Promise.all(
      Array.from({ length: 20 }, () => createOrder(db, checkout({ items: [{ artworkId: id, qty: 1 }] }), settings, t0)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.reason === "unavailable")).toHaveLength(19);
    expect(await statusOf(id)).toBe("reserved");
    expect(await db.select().from(orders)).toHaveLength(1);
  });

  it("a card order reserves for 15 min, numbers are LK-YYYY-NNNN, totals are snapshotted", async () => {
    const id = await artwork({ priceCents: 52_000 });
    const r = await createOrder(db, checkout({ items: [{ artworkId: id, qty: 1 }] }), settings, t0);
    expect(r).toMatchObject({ ok: true, number: "LK-2026-0001", status: "pending_payment", totalCents: 52_000 });
    if (!r.ok) throw new Error();
    const o = await orderOf(r.orderId);
    expect(o.expiresAt?.toISOString()).toBe("2026-11-13T10:15:00.000Z");
    expect(o.email).toBe("maria@example.com");
    expect(o.pricingSnapshot).toMatchObject({ shippingModel: "included", pickupDiscountPercent: 5 });
    const [item] = await db.select().from(orderItems).where(eq(orderItems.orderId, r.orderId));
    expect(item).toMatchObject({ titleBg: expect.stringMatching(/^Творба/), unitPriceCents: 52_000, holdsStock: true });

    const second = await createOrder(db, checkout({ items: [{ artworkId: await artwork(), qty: 1 }] }), settings, t0);
    expect(second).toMatchObject({ number: "LK-2026-0002" });
  });

  it("an expired reservation frees the artwork and fails the order", async () => {
    const id = await artwork();
    const r = await createOrder(db, checkout({ items: [{ artworkId: id, qty: 1 }] }), settings, t0);
    if (!r.ok) throw new Error();

    expect(await releaseExpiredReservations(db, new Date("2026-11-13T10:14:59Z"))).toEqual([]);
    expect(await releaseExpiredReservations(db, new Date("2026-11-13T10:15:00Z"))).toEqual([r.orderId]);
    expect(await statusOf(id)).toBe("available");
    expect((await orderOf(r.orderId)).status).toBe("payment_failed");

    // and someone else can buy it now
    const again = await createOrder(db, checkout({ items: [{ artworkId: id, qty: 1 }] }), settings, new Date("2026-11-13T10:16:00Z"));
    expect(again.ok).toBe(true);
  });

  it("a checkout releases expired reservations itself (no worker needed)", async () => {
    const id = await artwork();
    await createOrder(db, checkout({ items: [{ artworkId: id, qty: 1 }] }), settings, t0);
    const later = await createOrder(db, checkout({ items: [{ artworkId: id, qty: 1 }] }), settings, new Date("2026-11-13T10:30:00Z"));
    expect(later.ok).toBe(true);
  });

  it("the same myPOS notification 3 times → 1 payment, order paid, artwork sold", async () => {
    const id = await artwork();
    const r = await createOrder(db, checkout({ items: [{ artworkId: id, qty: 1 }] }), settings, t0);
    if (!r.ok) throw new Error();
    const notify = { orderNumber: r.number, providerRef: "IPC-123", amountCents: 45_000, result: "succeeded" as const };
    const outcomes = [];
    for (let i = 0; i < 3; i++) outcomes.push(await recordPaymentResult(db, notify, t0));
    expect(outcomes.map((o) => o.kind)).toEqual(["paid", "duplicate", "duplicate"]);
    expect(await db.select().from(payments)).toHaveLength(1);
    expect((await orderOf(r.orderId)).status).toBe("paid");
    expect(await statusOf(id)).toBe("sold");
  });

  it("a wrong amount is not accepted as payment", async () => {
    const id = await artwork();
    const r = await createOrder(db, checkout({ items: [{ artworkId: id, qty: 1 }] }), settings, t0);
    if (!r.ok) throw new Error();
    const out = await recordPaymentResult(db, { orderNumber: r.number, providerRef: "X", amountCents: 100, result: "succeeded" }, t0);
    expect(out).toMatchObject({ kind: "needs_refund", reason: "amount_mismatch" });
    expect((await orderOf(r.orderId)).status).toBe("pending_payment");
  });

  it("a declined payment fails the order and frees the artwork", async () => {
    const id = await artwork();
    const r = await createOrder(db, checkout({ items: [{ artworkId: id, qty: 1 }] }), settings, t0);
    if (!r.ok) throw new Error();
    const out = await recordPaymentResult(db, { orderNumber: r.number, providerRef: "D-1", amountCents: 45_000, result: "failed" }, t0);
    expect(out.kind).toBe("failed");
    expect(await statusOf(id)).toBe("available");
  });

  it("a late payment revives the order if the artwork is still free, otherwise asks for a refund", async () => {
    const free = await artwork();
    const a = await createOrder(db, checkout({ items: [{ artworkId: free, qty: 1 }] }), settings, t0);
    if (!a.ok) throw new Error();
    await releaseExpiredReservations(db, new Date("2026-11-13T11:00:00Z"));
    const late = await recordPaymentResult(db, { orderNumber: a.number, providerRef: "L-1", amountCents: 45_000, result: "succeeded" });
    expect(late.kind).toBe("paid");
    expect(await statusOf(free)).toBe("sold");

    const taken = await artwork();
    const b = await createOrder(db, checkout({ items: [{ artworkId: taken, qty: 1 }] }), settings, t0);
    if (!b.ok) throw new Error();
    await releaseExpiredReservations(db, new Date("2026-11-13T11:00:00Z"));
    const c = await createOrder(db, checkout({ items: [{ artworkId: taken, qty: 1 }], paymentMethod: "cod" }), settings, new Date("2026-11-13T11:01:00Z"));
    expect(c.ok).toBe(true);
    const tooLate = await recordPaymentResult(db, { orderNumber: b.number, providerRef: "L-2", amountCents: 45_000, result: "succeeded" });
    expect(tooLate).toMatchObject({ kind: "needs_refund", reason: "sold_meanwhile" });
  });

  it("cash on delivery: confirmed immediately and the artwork is sold", async () => {
    const id = await artwork();
    const r = await createOrder(db, checkout({ items: [{ artworkId: id, qty: 1 }], paymentMethod: "cod" }), settings, t0);
    expect(r).toMatchObject({ ok: true, status: "confirmed" });
    expect(await statusOf(id)).toBe("sold");
  });

  it("atelier pickup: −5 %, pay on pickup; cash on delivery is not offered there", async () => {
    const id = await artwork({ priceCents: 40_000 });
    const bad = await createOrder(db, checkout({ items: [{ artworkId: id, qty: 1 }], deliveryMethod: "pickup", paymentMethod: "cod" }), settings, t0);
    expect(bad).toMatchObject({ ok: false, reason: "invalid" });
    const r = await createOrder(db, checkout({ items: [{ artworkId: id, qty: 1 }], deliveryMethod: "pickup", paymentMethod: "on_pickup" }), settings, t0);
    expect(r).toMatchObject({ ok: true, status: "confirmed", totalCents: 38_000 });
  });

  it("cancelling releases the artwork; a returned shipment comes back hidden", async () => {
    const a = await artwork();
    const r1 = await createOrder(db, checkout({ items: [{ artworkId: a, qty: 1 }], paymentMethod: "cod" }), settings, t0);
    if (!r1.ok) throw new Error();
    await transitionOrder(db, r1.orderId, "cancelled", "owner@likina.com");
    expect(await statusOf(a)).toBe("available");

    const b = await artwork();
    const r2 = await createOrder(db, checkout({ items: [{ artworkId: b, qty: 1 }], paymentMethod: "cod" }), settings, t0);
    if (!r2.ok) throw new Error();
    await transitionOrder(db, r2.orderId, "shipped", "owner@likina.com");
    await transitionOrder(db, r2.orderId, "returned", "owner@likina.com");
    expect(await statusOf(b)).toBe("hidden");
    await expect(transitionOrder(db, r2.orderId, "shipped", "owner@likina.com")).rejects.toThrow(/cannot go/);
  });

  it("prints: stock is decremented and restored; sold out at 0", async () => {
    const p = await artwork({ kind: "print", stock: 2, priceCents: 8_000 });
    const r1 = await createOrder(db, checkout({ items: [{ artworkId: p, qty: 2 }] }), settings, t0);
    expect(r1).toMatchObject({ ok: true, totalCents: 16_000 });
    expect((await db.select().from(artworks).where(eq(artworks.id, p)))[0]).toMatchObject({ stock: 0, status: "sold" });
    const r2 = await createOrder(db, checkout({ items: [{ artworkId: p, qty: 1 }] }), settings, t0);
    expect(r2).toMatchObject({ ok: false, reason: "unavailable" });
    await releaseExpiredReservations(db, new Date("2026-11-13T12:00:00Z"));
    expect((await db.select().from(artworks).where(eq(artworks.id, p)))[0]).toMatchObject({ stock: 2, status: "available" });
  });

  it("artworks without a price, unpublished or a second copy of an original cannot be ordered", async () => {
    const noPrice = await artwork({ priceCents: null });
    const draft = await artwork({ status: "draft" });
    const original = await artwork();
    for (const items of [[{ artworkId: noPrice, qty: 1 }], [{ artworkId: draft, qty: 1 }], [{ artworkId: original, qty: 2 }]]) {
      expect(await createOrder(db, checkout({ items }), settings, t0)).toMatchObject({ ok: false, reason: "unavailable" });
    }
  });

  it("the database refuses a second active order for an original even without the app check", async () => {
    const id = await artwork();
    const r = await createOrder(db, checkout({ items: [{ artworkId: id, qty: 1 }], paymentMethod: "cod" }), settings, t0);
    if (!r.ok) throw new Error();
    const [o] = await db.select().from(orders);
    await expect(
      db.insert(orderItems).values({ orderId: o!.id, artworkId: id, kind: "original", titleBg: "x", qty: 1, unitPriceCents: 1, lineTotalCents: 1 }),
    ).rejects.toThrow();
  });

  it("sold outside the site: only when not in an active order", async () => {
    const free = await artwork();
    await markSoldOffline(db, free, "owner@likina.com");
    expect((await db.select().from(artworks).where(eq(artworks.id, free)))[0]).toMatchObject({ status: "sold", soldOffline: true });
    await expect(markSoldOffline(db, free, "owner@likina.com")).rejects.toThrow(SoldOfflineError);

    const busy = await artwork();
    await createOrder(db, checkout({ items: [{ artworkId: busy, qty: 1 }] }), settings, t0);
    await expect(markSoldOffline(db, busy, "owner@likina.com")).rejects.toMatchObject({ code: "in_order" });
    expect(await createOrder(db, checkout({ items: [{ artworkId: free, qty: 1 }] }), settings, t0)).toMatchObject({ ok: false });
  });
});
