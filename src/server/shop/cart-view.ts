import { getDb } from "@/db/client";
import { quoteOrder } from "@/domain/pricing";
import { listPublicArtworks, type CardArtwork } from "@/server/catalog";
import { readCart } from "@/server/cart";
import { loadSettings } from "@/server/settings";

/** The cart with live artwork data (price, availability). Unavailable lines are flagged, not dropped. */
export async function cartView() {
  const lines = await readCart(); // request-time (cookie) — keeps the DB reads below out of the prerender
  const [all, s] = await Promise.all([listPublicArtworks(), loadSettings(getDb())]);
  const items = lines
    .map((l) => ({ ...l, artwork: all.find((a) => a.id === l.id) }))
    .filter((x): x is { id: string; qty: number; artwork: CardArtwork } => !!x.artwork)
    .map((x) => ({ ...x, available: x.artwork.status === "available" && x.artwork.priceCents !== null }));
  const buyable = items.filter((i) => i.available);
  const settings = { pickupDiscountPercent: s.pickupDiscountPercent, shippingModel: s.shippingModel };
  const toLines = () => buyable.map((i) => ({ unitPriceCents: i.artwork.priceCents!, qty: i.qty }));
  return {
    settings: s,
    items,
    buyable,
    delivered: buyable.length ? quoteOrder(toLines(), "econt_office", settings) : null,
    pickup: buyable.length ? quoteOrder(toLines(), "pickup", settings) : null,
  };
}
