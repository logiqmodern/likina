import { messages, type Lang } from "@/i18n";

const ICONS = [
  // truck
  "M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  // shield
  "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4",
  // card
  "M3 6h18v12H3zM3 10h18M7 15h4",
  // return
  "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
];

/** The four buying promises (§4.1 trust block), as a strip under the hero. */
export function TrustStrip({ lang }: { lang: Lang }) {
  return (
    <ul className="container-site grid grid-cols-1 gap-x-6 gap-y-3 border-b border-line py-6 sm:grid-cols-2 lg:grid-cols-4">
      {messages[lang].artwork.trust.map((text, i) => (
        <li key={text} className="flex items-center gap-3 text-[15px] font-semibold text-ink">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#F3ECE1] text-accent-600">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={ICONS[i]} />
            </svg>
          </span>
          {text}
        </li>
      ))}
    </ul>
  );
}
