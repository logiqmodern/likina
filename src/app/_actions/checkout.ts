"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { normalizePhone } from "@/domain/phone";
import { href, messages, type Lang } from "@/i18n";
import { deliverSoon } from "@/server/email/kick";
import { readCart, writeCart } from "@/server/cart";
import { myposConfig } from "@/server/mypos";
import { announceOrder } from "@/server/shop/order-emails";
import { createOrder } from "@/server/shop/orders";
import { loadSettings } from "@/server/settings";

/* One-page checkout (§6.2): validates, creates the order, then card → myPOS, pay later → order page. */

export interface CheckoutState {
  status: "idle" | "error";
  errors?: Record<string, string>;
  values?: Record<string, string>;
}

const DELIVERY = ["econt_office", "econt_address", "econt_locker", "pickup"] as const;
const PAYMENT = ["mypos", "cod", "on_pickup"] as const;

function str(fd: FormData, k: string, max = 300): string {
  return String(fd.get(k) ?? "").trim().slice(0, max);
}

export async function placeOrder(_prev: CheckoutState, fd: FormData): Promise<CheckoutState> {
  const lang: Lang = fd.get("lang") === "en" ? "en" : "bg";
  const e = messages[lang].checkout.errors;
  const keys = ["name", "email", "phone", "deliveryMethod", "city", "postCode", "office", "address", "paymentMethod", "invoice", "company", "eik", "vat", "mol", "companyAddress", "notes", "terms", "marketing"];
  const values = Object.fromEntries(keys.map((k) => [k, str(fd, k, k === "notes" ? 1000 : 300)]));
  const errors: Record<string, string> = {};

  const deliveryMethod = DELIVERY.find((d) => d === values.deliveryMethod) ?? "econt_office";
  let paymentMethod = PAYMENT.find((p) => p === values.paymentMethod) ?? "cod";
  // the payment options depend on the delivery: no COD at the atelier, no "pay on pick-up" for a shipment
  if (deliveryMethod === "pickup" && paymentMethod === "cod") paymentMethod = "on_pickup";
  if (deliveryMethod !== "pickup" && paymentMethod === "on_pickup") paymentMethod = "cod";

  if (values.name!.length < 2) errors.name = e.name;
  if (!z.email().safeParse(values.email).success) errors.email = e.email;
  const phone = normalizePhone(values.phone!);
  if (!phone) errors.phone = e.phone;
  if (deliveryMethod !== "pickup") {
    if (!values.city) errors.city = e.city;
    if (deliveryMethod === "econt_address" ? !values.address : !values.office) errors[deliveryMethod === "econt_address" ? "address" : "office"] = e.office;
  }
  if (values.invoice && (!values.company || !values.eik || !values.mol || !values.companyAddress)) errors.company = e.invoice;
  if (!values.terms) errors.terms = e.terms;
  if (paymentMethod === "mypos" && !myposConfig()) errors.paymentMethod = messages[lang].checkout.cardUnavailable;
  if (Object.keys(errors).length) return { status: "error", errors: { _form: e.form, ...errors }, values };

  const cart = await readCart();
  if (cart.length === 0) return { status: "error", errors: { _form: e.empty }, values };

  const db = getDb();
  let result;
  try {
    result = await createOrder(
      db,
      {
        items: cart.map((l) => ({ artworkId: l.id, qty: l.qty })),
        customerName: values.name!,
        email: values.email!,
        phone: phone!,
        deliveryMethod,
        delivery:
          deliveryMethod === "pickup"
            ? {}
            : {
                city: values.city,
                postCode: values.postCode || undefined,
                ...(deliveryMethod === "econt_address" ? { address: values.address } : { officeName: values.office }),
              },
        paymentMethod,
        locale: lang,
        invoice: values.invoice
          ? { company: values.company!, eik: values.eik!, vatNumber: values.vat || undefined, mol: values.mol!, address: values.companyAddress! }
          : null,
        notesClient: values.notes || null,
        marketingConsent: !!values.marketing,
      },
      await loadSettings(db),
    );
  } catch (error) {
    console.error("[checkout] order failed", error);
    return { status: "error", errors: { _form: e.generic }, values };
  }

  if (!result.ok) {
    if (result.reason === "unavailable") {
      await writeCart(cart.filter((l) => !result.artworkIds.includes(l.id)));
      return { status: "error", errors: { _form: e.unavailable }, values };
    }
    return { status: "error", errors: { _form: e.generic }, values };
  }

  await writeCart([]);
  if (result.status !== "pending_payment") deliverSoon(await announceOrder(db, result.orderId));
  redirect(`${href.order(lang, result.token)}${result.status === "pending_payment" ? "?pay=1" : ""}`);
}
