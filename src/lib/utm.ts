/**
 * Ad attribution parameters that must survive the jump from a landing page to
 * the booking flow (docs/PROMPT.md §4.7, §9.3): every `utm_*`, `fbclid`, `gclid`.
 */

const UTM_KEY = /^utm_[a-z0-9_]{1,40}$/i;
const CLICK_IDS = new Set(["fbclid", "gclid"]);
/** Click ids are long but bounded; anything bigger is not a real ad parameter. */
const MAX_VALUE_LENGTH = 500;

export function isTrackingParam(key: string): boolean {
  return UTM_KEY.test(key) || CLICK_IDS.has(key);
}

/** Minimal read-only interface shared by URLSearchParams and Next's ReadonlyURLSearchParams. */
interface ParamsLike {
  forEach(callback: (value: string, key: string) => void): void;
}

/**
 * Returns `href` with the tracking parameters of the current page appended.
 * Only same-site relative paths ("/…") are touched; parameters already present
 * in `href` win, empty or oversized values are dropped.
 */
export function withTrackingParams(href: string, current: ParamsLike | null | undefined): string {
  if (!current || !href.startsWith("/") || href.startsWith("//")) return href;

  const url = new URL(href, "http://local.invalid");
  let changed = false;
  current.forEach((value, key) => {
    if (!isTrackingParam(key) || value === "" || value.length > MAX_VALUE_LENGTH) return;
    if (url.searchParams.has(key)) return;
    url.searchParams.append(key, value);
    changed = true;
  });

  return changed ? `${url.pathname}${url.search}${url.hash}` : href;
}
