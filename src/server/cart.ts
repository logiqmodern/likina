import { cookies } from "next/headers";

/*
 * The cart lives in a cookie (§6.1: no account): [{ id, qty }]. Prices and
 * availability are always read from the database, never from the cookie.
 */

export const CART_COOKIE = "likina_cart";
const MAX_LINES = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CartLine = { id: string; qty: number };

export function parseCart(raw: string | undefined): CartLine[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const out: CartLine[] = [];
    for (const l of data) {
      const id = (l as CartLine)?.id;
      const qty = Number((l as CartLine)?.qty);
      if (typeof id === "string" && UUID.test(id) && Number.isInteger(qty) && qty >= 1 && qty <= 10 && !out.some((x) => x.id === id)) {
        out.push({ id, qty });
      }
    }
    return out.slice(0, MAX_LINES);
  } catch {
    return [];
  }
}

export async function readCart(): Promise<CartLine[]> {
  return parseCart((await cookies()).get(CART_COOKIE)?.value);
}

export async function writeCart(lines: CartLine[]): Promise<void> {
  const jar = await cookies();
  if (lines.length === 0) {
    jar.delete(CART_COOKIE);
    return;
  }
  jar.set(CART_COOKIE, JSON.stringify(lines.slice(0, MAX_LINES)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
