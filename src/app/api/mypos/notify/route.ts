import { getDb } from "@/db/client";
import { deliverSoon } from "@/server/email/kick";
import { raiseAlert } from "@/server/email/outbox";
import { myposConfig, readNotification } from "@/server/mypos";
import { announceOrder } from "@/server/shop/order-emails";
import { recordPaymentResult } from "@/server/shop/orders";

/*
 * myPOS server notification (URL_Notify, §6.4): IPCPurchaseNotify (paid),
 * IPCPurchaseCancel, IPCPurchaseRollback. The signature is checked with the
 * myPOS certificate; processing is idempotent; myPOS expects "OK".
 */
export async function POST(request: Request) {
  const cfg = myposConfig();
  if (!cfg) return new Response("not configured", { status: 503 });
  const n = readNotification(new URLSearchParams(await request.text()), cfg);
  if (!n) return new Response("bad signature", { status: 400 });

  const db = getDb();
  const succeeded = n.method === "IPCPurchaseNotify";
  if (n.amountCents === null || n.currency !== "EUR") return new Response("OK");
  const outcome = await recordPaymentResult(db, {
    orderNumber: n.orderNumber,
    providerRef: `${n.method}:${n.transactionRef || n.orderNumber}`,
    amountCents: n.amountCents,
    result: succeeded ? "succeeded" : n.method === "IPCPurchaseCancel" ? "cancelled" : "failed",
    raw: n.raw,
  });

  if (outcome.kind === "paid") deliverSoon(await announceOrder(db, outcome.orderId));
  if (outcome.kind === "needs_refund") {
    await raiseAlert(db, {
      topic: `refund:${outcome.orderId}`,
      subject: `Плащане за поръчка ${n.orderNumber} изисква възстановяване`,
      lines: [`Причина: ${outcome.reason}`, `Сума: ${n.amountCents / 100} EUR`, "Възстановете сумата от myPOS акаунта."],
      now: new Date(),
    });
  }
  return new Response("OK", { headers: { "content-type": "text/plain" } });
}
