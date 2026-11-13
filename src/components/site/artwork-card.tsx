import Image from "next/image";
import Link from "next/link";
import { formatDimensions } from "@/domain/artwork-size";
import { formatEur } from "@/domain/pricing";
import { href, messages, pick, type Lang } from "@/i18n";
import { mediaSrc } from "@/lib/media";
import type { CardArtwork } from "@/server/catalog";

export function Price({ lang, cents, compareAt }: { lang: Lang; cents: number | null; compareAt?: number | null }) {
  if (cents === null) return <span className="text-ink-2">{messages[lang].artwork.onRequest}</span>;
  return (
    <span className="font-bold tabular-nums text-ink">
      {compareAt && compareAt > cents ? <s className="mr-2 font-medium text-muted">{formatEur(compareAt, lang)}</s> : null}
      {formatEur(cents, lang)}
    </span>
  );
}

const ARTIST_NAMES: Record<string, { bg: string; en: string }> = {
  "gergana-nikiforova": { bg: "Гергана Никифорова", en: "Gergana Nikiforova" },
  "rumen-bozhinov": { bg: "Румен Божинов", en: "Rumen Bozhinov" },
};

export function ArtworkCard({ lang, a, priority = false }: { lang: Lang; a: CardArtwork; priority?: boolean }) {
  const t = messages[lang].artwork;
  const title = pick(lang, a.titleBg, a.titleEn);
  const size = formatDimensions(a, lang);
  return (
    <Link href={href.artwork(lang, lang === "bg" ? a.slug : a.slugEn)} className="group flex h-full flex-col gap-3">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-white ring-1 ring-line transition-shadow group-hover:shadow-[0_18px_40px_-24px_rgba(42,31,26,0.5)]">
        {a.cover ? (
          <Image
            src={mediaSrc(a.cover.id)}
            alt={pick(lang, a.cover.altBg, a.cover.altEn).text ?? ""}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-contain p-3 transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : null}
        {a.status !== "available" ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[13px] font-bold text-ink">
            {a.status === "sold" ? t.sold : t.reserved}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        {a.artistSlug && ARTIST_NAMES[a.artistSlug] ? <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">{ARTIST_NAMES[a.artistSlug]![lang]}</p> : null}
        <h3 lang={title.lang} className="text-[16px] font-bold leading-snug text-ink group-hover:underline group-hover:underline-offset-4">
          {title.text}
        </h3>
        {size ? <p className="text-[14px] tabular-nums text-muted">{size}</p> : null}
        {a.status === "available" ? <Price lang={lang} cents={a.priceCents} compareAt={a.compareAtCents} /> : null}
      </div>
    </Link>
  );
}

export function ArtworkGrid({ lang, items }: { lang: Lang; items: CardArtwork[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((a, i) => (
        <li key={a.id}>
          <ArtworkCard lang={lang} a={a} priority={i < 4} />
        </li>
      ))}
    </ul>
  );
}
