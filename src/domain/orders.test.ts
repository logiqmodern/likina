import { describe, expect, it } from "vitest";
import {
  ORDER_STATUSES,
  OrderTransitionError,
  assertTransition,
  canTransition,
  formatOrderNumber,
  holdsStock,
  initialStatus,
  nextStatuses,
  type OrderContext,
} from "./orders";

const card: Omit<OrderContext, "status"> = { paymentMethod: "mypos", deliveryMethod: "econt_office" };
const cod: Omit<OrderContext, "status"> = { paymentMethod: "cod", deliveryMethod: "econt_address" };
const atelierCash: Omit<OrderContext, "status"> = { paymentMethod: "on_pickup", deliveryMethod: "pickup" };
const atelierCard: Omit<OrderContext, "status"> = { paymentMethod: "mypos", deliveryMethod: "pickup" };

describe("order transitions", () => {
  it("card happy path", () => {
    const path = ["pending_payment", "paid", "shipped", "delivered", "completed"] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition({ ...card, status: path[i]! }, path[i + 1]!)).toBe(true);
    }
  });

  it("cash on delivery happy path", () => {
    expect(initialStatus("cod")).toBe("confirmed");
    expect(canTransition({ ...cod, status: "confirmed" }, "shipped")).toBe(true);
    expect(canTransition({ ...cod, status: "shipped" }, "delivered")).toBe(true);
    expect(canTransition({ ...cod, status: "delivered" }, "completed")).toBe(true);
  });

  it("atelier pickup is handed over, never shipped", () => {
    expect(canTransition({ ...atelierCash, status: "confirmed" }, "delivered")).toBe(true);
    expect(canTransition({ ...atelierCard, status: "paid" }, "delivered")).toBe(true);
    expect(canTransition({ ...atelierCash, status: "confirmed" }, "shipped")).toBe(false);
  });

  it("a shipment cannot skip 'shipped'", () => {
    expect(canTransition({ ...card, status: "paid" }, "delivered")).toBe(false);
    expect(canTransition({ ...cod, status: "confirmed" }, "delivered")).toBe(false);
  });

  it("only card orders become paid; refunds only where money was taken", () => {
    expect(canTransition({ ...cod, status: "confirmed" }, "paid")).toBe(false);
    expect(canTransition({ ...card, status: "paid" }, "refunded")).toBe(true);
    expect(canTransition({ ...cod, status: "cancelled" }, "refunded")).toBe(false);
    expect(canTransition({ ...card, status: "cancelled" }, "refunded")).toBe(true);
  });

  it("a late payment can revive a failed card order", () => {
    expect(canTransition({ ...card, status: "payment_failed" }, "paid")).toBe(true);
  });

  it("refunded is final and pending payment cannot be shipped", () => {
    for (const to of ORDER_STATUSES) expect(canTransition({ ...card, status: "refunded" }, to)).toBe(false);
    expect(canTransition({ ...card, status: "pending_payment" }, "shipped")).toBe(false);
  });

  it("assertTransition throws a typed error", () => {
    expect(() => assertTransition({ ...card, status: "completed" }, "pending_payment")).toThrow(OrderTransitionError);
  });

  it("nextStatuses lists only valid buttons", () => {
    expect(nextStatuses({ ...cod, status: "confirmed" })).toEqual(["shipped", "cancelled"]);
    expect(nextStatuses({ ...atelierCash, status: "confirmed" })).toEqual(["delivered", "cancelled"]);
  });
});

describe("holdsStock", () => {
  it("active orders hold their artworks; failed/cancelled/returned/refunded release them", () => {
    expect(holdsStock("pending_payment")).toBe(true);
    expect(holdsStock("confirmed")).toBe(true);
    expect(holdsStock("completed")).toBe(true);
    for (const s of ["payment_failed", "cancelled", "returned", "refunded"] as const) expect(holdsStock(s)).toBe(false);
  });
});

describe("formatOrderNumber", () => {
  it("pads the sequence", () => {
    expect(formatOrderNumber(2026, 1)).toBe("LK-2026-0001");
    expect(formatOrderNumber(2026, 12345)).toBe("LK-2026-12345");
    expect(() => formatOrderNumber(2026, 0)).toThrow(RangeError);
  });
});
