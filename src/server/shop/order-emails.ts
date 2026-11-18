import type { Database } from "@/db/client";
import { orders } from "@/db/schema";
import { enqueueEmail, sellerAddress } from "@/server/email/outbox";
import { eq } from "drizzle-orm";

/**
 * After an order is confirmed (pay later) or paid (card): confirmation to the
 * customer, notice to the seller by e-mail. Idempotent (dedupe keys).
 * Returns the queued e-mail ids for deliverSoon().
 */
export async function announceOrder(db: Database, orderId: string, now: Date = new Date()): Promise<string[]> {
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o) return [];
  const ids: string[] = [];
  const customer = await enqueueEmail(db, { kind: "order_confirmed", to: o.email, orderId, now, dedupeKey: `order_confirmed:${orderId}` });
  if (customer) ids.push(customer);
  const seller = await sellerAddress(db);
  if (seller) {
    const id = await enqueueEmail(db, { kind: "seller_new_order", to: seller, orderId, now, dedupeKey: `seller_new_order:${orderId}` });
    if (id) ids.push(id);
  }
  return ids;
}
