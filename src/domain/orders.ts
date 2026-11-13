/**
 * Order statuses and their allowed transitions (docs/PROMPT.md §5.2).
 *
 * Card:          pending_payment → paid → shipped → delivered → completed
 * Pay later:     confirmed (cash on delivery / at the atelier) → shipped → delivered → completed
 * Atelier:       paid | confirmed → delivered (handed over) → completed
 * Side statuses: payment_failed, cancelled, returned, refunded.
 *
 * Every status change goes through `assertTransition`, so the rules live in one table.
 */

export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "confirmed",
  "shipped",
  "delivered",
  "completed",
  "payment_failed",
  "cancelled",
  "returned",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentMethod = "mypos" | "cod" | "on_pickup";
export type DeliveryMethod = "econt_office" | "econt_address" | "econt_locker" | "pickup";

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ["paid", "payment_failed", "cancelled"],
  // a late successful payment can revive a failed one (if the artworks are still free)
  payment_failed: ["paid", "cancelled"],
  paid: ["shipped", "delivered", "cancelled", "refunded"],
  confirmed: ["shipped", "delivered", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: ["completed", "returned"],
  completed: ["returned", "refunded"],
  returned: ["refunded"],
  cancelled: ["refunded"],
  refunded: [],
};

export interface OrderContext {
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  deliveryMethod: DeliveryMethod;
}

export class OrderTransitionError extends Error {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
    reason: string,
  ) {
    super(`order cannot go from ${from} to ${to}: ${reason}`);
    this.name = "OrderTransitionError";
  }
}

/** Why a transition is not allowed, or null if it is. */
export function transitionProblem(order: OrderContext, to: OrderStatus): string | null {
  const { status: from, paymentMethod, deliveryMethod } = order;
  if (!TRANSITIONS[from].includes(to)) return "not an allowed step";
  const pickup = deliveryMethod === "pickup";
  if (to === "shipped" && pickup) return "an atelier pickup is not shipped";
  if (to === "delivered" && (from === "paid" || from === "confirmed") && !pickup) return "a shipment must be shipped first";
  if (to === "paid" && paymentMethod !== "mypos") return "only card orders are paid online";
  if (to === "refunded" && from === "cancelled" && paymentMethod !== "mypos") return "nothing was paid";
  if (to === "refunded" && from === "paid" && paymentMethod !== "mypos") return "nothing was paid";
  return null;
}

export function canTransition(order: OrderContext, to: OrderStatus): boolean {
  return transitionProblem(order, to) === null;
}

export function assertTransition(order: OrderContext, to: OrderStatus): void {
  const problem = transitionProblem(order, to);
  if (problem) throw new OrderTransitionError(order.status, to, problem);
}

/** Next statuses the admin can choose from (the UI shows only these buttons). */
export function nextStatuses(order: OrderContext): OrderStatus[] {
  return TRANSITIONS[order.status].filter((to) => canTransition(order, to));
}

/** The first status of a new order. */
export function initialStatus(paymentMethod: PaymentMethod): OrderStatus {
  return paymentMethod === "mypos" ? "pending_payment" : "confirmed";
}

/** While an order is in one of these, its artworks are taken (reserved or sold). */
export const STOCK_HOLDING: ReadonlySet<OrderStatus> = new Set([
  "pending_payment",
  "paid",
  "confirmed",
  "shipped",
  "delivered",
  "completed",
]);

export function holdsStock(status: OrderStatus): boolean {
  return STOCK_HOLDING.has(status);
}

/** Timestamp column set when an order enters a status. */
export function timestampFor(to: OrderStatus): "paidAt" | "shippedAt" | "deliveredAt" | "closedAt" | null {
  switch (to) {
    case "paid":
      return "paidAt";
    case "shipped":
      return "shippedAt";
    case "delivered":
      return "deliveredAt";
    case "completed":
    case "cancelled":
    case "refunded":
    case "returned":
      return "closedAt";
    default:
      return null;
  }
}

/** "LK-2026-0001" */
export function formatOrderNumber(year: number, seq: number): string {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) throw new RangeError(`bad year ${year}`);
  if (!Number.isInteger(seq) || seq < 1) throw new RangeError(`bad sequence ${seq}`);
  return `LK-${year}-${String(seq).padStart(4, "0")}`;
}

/** Labels for the admin (Bulgarian only) and the customer (BG + EN). */
export const ORDER_STATUS_LABELS: Record<OrderStatus, { bg: string; en: string }> = {
  pending_payment: { bg: "Чака плащане", en: "Awaiting payment" },
  paid: { bg: "Платена", en: "Paid" },
  confirmed: { bg: "Потвърдена", en: "Confirmed" },
  shipped: { bg: "Изпратена", en: "Shipped" },
  delivered: { bg: "Доставена", en: "Delivered" },
  completed: { bg: "Приключена", en: "Completed" },
  payment_failed: { bg: "Неуспешно плащане", en: "Payment failed" },
  cancelled: { bg: "Отказана", en: "Cancelled" },
  returned: { bg: "Върната", en: "Returned" },
  refunded: { bg: "Възстановена сума", en: "Refunded" },
};
