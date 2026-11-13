/*
 * Bulgarian → Latin slugs ("Св. Богородица Умиление" → "sv-bogoroditsa-umilenie").
 * Official Bulgarian transliteration (Закон за транслитерацията): ц → ts,
 * щ → sht, ъ → a, ю → yu, я → ya; "-ия" at the end of a word → "-ia";
 * "България" → "bulgaria" (the law's own exception).
 */

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht",
  ъ: "a", ь: "y", ю: "yu", я: "ya", ѝ: "i", ё: "yo", э: "e", ы: "y",
};

export const SLUG_MAX = 80;

export function slugify(text: string, max = SLUG_MAX): string {
  return text
    .toLowerCase()
    .normalize("NFC")
    .replace(/българ/gu, "bulgar")
    .replace(/ия(?=$|[^а-яѝ])/gu, "ia")
    .split("")
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

/** 2–80 chars, lowercase latin letters, digits, single hyphens. */
export function isValidSlug(slug: string): boolean {
  return slug.length >= 2 && slug.length <= SLUG_MAX && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/** `base`, or `base-2`, `base-3`… — the first one not in `taken`. */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}
