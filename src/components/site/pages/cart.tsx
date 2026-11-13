import Image from "next/image";
import Link from "next/link";
import { removeFromCart } from "@/app/_actions/cart";
import { formatEur } from "@/domain/pricing";
import { href, messages, pick, type Lang } from "@/i18n";
import { mediaSrc } from "@/lib/media";
import { myposConfig } from "@/server/mypos";
import { cartView } from "@/server/shop/cart-view";
import { CheckoutForm } from "../checkout-form";
import { SiteShell } from "../shell";

type View = Awaited<ReturnType<typeof cartView>>;

function Lines({ lang, view, removable }: { lang: Lang; view: View; removable: boolean }) {
  const t = messages[lang].cart;
  return (
    <ul className="flex flex-col divide-y divide-line">
      {view.items.map((i) => {
        const title = pick(lang, i.artwork.titleBg, i.artwork.titleEn);
        return (
          <li key={i.id} className="flex gap-4 py-4">
            <Link href={href.artwork(lang, lang === "bg" ? i.artwork.slug : i.artwork.slugEn)} className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-tint-50">
              {i.artwork.cover ? <Image src={mediaSrc(i.artwork.cover.id)} alt="" fill sizes="80px" className="object-contain p-1" /> : null}
            </Link>
            <div className="flex flex-1 flex-col gap-1">
              <p lang={title.lang} className="font-bold">
                {title.text}
              </p>
              {i.available ? <p className="tabular-nums">{formatEur(i.artwork.priceCents! * i.qty, lang)}</p> : <p className="font-semibold text-error">{t.unavailable}</p>}
              {removable ? (
                <form action={removeFromCart}>
                  <input type="hidden" name="artworkId" value={i.id} />
                  <input type="hidden" name="lang" value={lang} />
                  <button type="submit" className="link text-[14px] text-muted">
                    {t.remove}
                  </button>
                </form>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function Totals({ lang, view }: { lang: Lang; view: View }) {
  const t = messages[lang].cart;
  if (!view.delivered) return null;
  return (
    <dl className="flex flex-col gap-2 text-[16px]">
      <div className="flex justify-between">
        <dt>{t.subtotal}</dt>
        <dd className="tabular-nums">{formatEur(view.delivered.subtotalCents, lang)}</dd>
      </div>
      <div className="flex justify-between">
        <dt>{t.shipping}</dt>
        <dd className="font-semibold text-success">{t.free}</dd>
      </div>
      <div className="flex justify-between border-t border-line pt-2 text-[18px] font-extrabold">
        <dt>{t.total}</dt>
        <dd className="tabular-nums">{formatEur(view.delivered.totalCents, lang)}</dd>
      </div>
      <p className="text-[14px] text-muted">{t.pickupNote}</p>
    </dl>
  );
}

export async function CartPage({ lang }: { lang: Lang }) {
  const t = messages[lang].cart;
  const view = await cartView();
  return (
    <SiteShell lang={lang} alt={href.page(lang === "bg" ? "en" : "bg", "cart")}>
      <div className="container-site flex max-w-3xl flex-col gap-6 py-10">
        <h1 className="h1">{t.title}</h1>
        {view.items.length === 0 ? (
          <p className="text-ink-2">
            {t.empty}{" "}
            <Link href={href.page(lang, "gallery")} className="link font-semibold">
              {messages[lang].nav.gallery}
            </Link>
          </p>
        ) : (
          <>
            <Lines lang={lang} view={view} removable />
            <Totals lang={lang} view={view} />
            <div className="flex flex-col gap-3 sm:flex-row">
              {view.buyable.length ? (
                <Link href={href.page(lang, "checkout")} className="btn btn-primary btn-lg sm:flex-1">
                  {t.checkout}
                </Link>
              ) : null}
              <Link href={href.page(lang, "gallery")} className="btn btn-secondary btn-lg sm:flex-1">
                {t.continue}
              </Link>
            </div>
          </>
        )}
      </div>
    </SiteShell>
  );
}

export async function CheckoutPage({ lang }: { lang: Lang }) {
  const t = messages[lang];
  const view = await cartView();
  return (
    <SiteShell lang={lang} alt={href.page(lang === "bg" ? "en" : "bg", "checkout")}>
      <div className="container-site grid gap-8 py-10 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-6">
          <h1 className="h1">{t.checkout.title}</h1>
          {view.buyable.length === 0 ? (
            <p className="text-ink-2">
              {t.cart.empty}{" "}
              <Link href={href.page(lang, "gallery")} className="link font-semibold">
                {t.nav.gallery}
              </Link>
            </p>
          ) : (
            <CheckoutForm
              lang={lang}
              cardEnabled={!!myposConfig()}
              totals={{ delivered: view.delivered!.totalCents, pickup: view.pickup!.totalCents, pickupDiscount: view.pickup!.discountCents }}
            />
          )}
        </div>
        {view.items.length ? (
          <aside className="card flex flex-col gap-4 self-start p-5 lg:sticky lg:top-24">
            <h2 className="h3">{t.checkout.summary}</h2>
            <Lines lang={lang} view={view} removable={false} />
            <Totals lang={lang} view={view} />
          </aside>
        ) : null}
      </div>
    </SiteShell>
  );
}
