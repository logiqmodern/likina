"use server";

import { redirect } from "next/navigation";
import { href, type Lang } from "@/i18n";
import { readCart, writeCart } from "@/server/cart";

function langOf(formData: FormData): Lang {
  return formData.get("lang") === "en" ? "en" : "bg";
}

/** „Купи“: adds the artwork (originals: qty 1) and opens the cart. */
export async function addToCart(formData: FormData): Promise<void> {
  const id = String(formData.get("artworkId") ?? "");
  const lines = await readCart();
  if (id && !lines.some((l) => l.id === id)) await writeCart([...lines, { id, qty: 1 }]);
  redirect(href.page(langOf(formData), "cart"));
}

export async function removeFromCart(formData: FormData): Promise<void> {
  const id = String(formData.get("artworkId") ?? "");
  await writeCart((await readCart()).filter((l) => l.id !== id));
  redirect(href.page(langOf(formData), "cart"));
}
