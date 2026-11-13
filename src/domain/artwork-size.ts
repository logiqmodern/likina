/**
 * Sizes of artworks: parsing the free-text sizes of the old WooCommerce
 * descriptions into a *suggestion* the client confirms in the admin (§15),
 * and formatting millimetres as centimetres for the site.
 */

export interface Dimensions {
  widthMm: number;
  heightMm: number;
  depthMm: number | null;
}

export interface SizeSuggestion extends Dimensions {
  /** true when the chosen size is the framed (outer) size */
  framed: boolean | null;
  /** every size line found, for the admin check */
  note: string;
}

const NUM = String.raw`(\d{1,3}(?:[.,]\d{1,2})?)`;
const SEP = String.raw`\s*[/xXхХ×*]\s*`;
const DIMS = new RegExp(`${NUM}${SEP}${NUM}(?:${SEP}${NUM})?\\s*(?:см|cm)?`, "u");

function toMm(value: string): number {
  return Math.round(Number(value.replace(",", ".")) * 10);
}

/** "30.5 x 19.5 см", "35/35 см", "16х21", "48 × 35 × 2.5 см" → millimetres; null if there is no W × H pair. */
export function parseDimensions(text: string): Dimensions | null {
  const m = DIMS.exec(text);
  if (!m) return null;
  const [w, h, d] = [m[1]!, m[2]!, m[3]];
  const widthMm = toMm(w);
  const heightMm = toMm(h);
  const depthMm = d ? toMm(d) : null;
  if (widthMm <= 0 || heightMm <= 0 || (depthMm !== null && depthMm <= 0)) return null;
  // sanity: 1 cm – 3 m per side, depth ≤ 30 cm
  if (widthMm < 10 || heightMm < 10 || widthMm > 3000 || heightMm > 3000) return null;
  if (depthMm !== null && depthMm > 300) return null;
  return { widthMm, heightMm, depthMm };
}

const SIZE_LABEL = /(размер|рамер)/iu;

/**
 * Picks the size to suggest from description text: the framed / outer size
 * when there is one (that is what hangs on the wall and what is shipped),
 * otherwise the first size found. Labels and numbers may be on separate lines.
 */
export function suggestSize(text: string): SizeSuggestion | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/[• ]/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const found: Array<{ label: string; line: string; dims: Dimensions }> = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!SIZE_LABEL.test(line)) continue;
    let dims = parseDimensions(line);
    let shown = line;
    if (!dims && i + 1 < lines.length) {
      // "Размер с рамката:" + "112 × 131 см" on the next line
      dims = parseDimensions(lines[i + 1]!);
      shown = `${line} ${lines[i + 1]}`;
    }
    if (dims && !found.some((f) => f.line === shown)) found.push({ label: line.toLowerCase(), line: shown, dims });
  }
  if (found.length === 0) return null;

  const isFramed = (label: string) => /рамк/u.test(label) && !/без рамк/u.test(label);
  const framedOne = found.find((f) => isFramed(f.label) || /външен/u.test(f.label));
  const chosen = framedOne ?? found[0]!;
  const anyFrameMention = found.some((f) => /рамк/u.test(f.label));
  return {
    ...chosen.dims,
    framed: framedOne ? true : anyFrameMention ? false : null,
    note: found.map((f) => f.line).join("\n"),
  };
}

function cm(mm: number, locale: "bg" | "en"): string {
  const v = mm / 10;
  const s = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return locale === "bg" ? s.replace(".", ",") : s;
}

/** "30,5 × 19,5 см" / "30.5 × 19.5 cm" (depth included when known). */
export function formatDimensions(
  d: { widthMm?: number | null; heightMm?: number | null; depthMm?: number | null },
  locale: "bg" | "en",
): string | null {
  if (!d.widthMm || !d.heightMm) return null;
  const parts = [d.widthMm, d.heightMm, ...(d.depthMm ? [d.depthMm] : [])].map((mm) => cm(mm, locale));
  return `${parts.join(" × ")} ${locale === "bg" ? "см" : "cm"}`;
}
