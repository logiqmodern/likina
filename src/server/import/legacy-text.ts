/*
 * Cleaning of the old WooCommerce product texts (spec §15.2).
 *
 * The old descriptions mix three things: spec lines ("Размер: 30 x 20 см",
 * "Техника: …"), shop boilerplate (✓ trust bullets, contact paragraph,
 * "Сертификат за автентичност" — no longer issued) and the real text about
 * the artwork. This module turns them into structured fields + clean HTML
 * (only <h3>, <p>, <ul>/<li>), and reports what it removed.
 */

export interface CleanedText {
  html: string;
  /** plain text length of the narrative (used to pick the better source) */
  narrativeChars: number;
  technique: string | null;
  materials: string | null;
  /** every size line, as written */
  sizeLines: string[];
  /** "С рамка: Да" / "Рамкирана и подписана: Да" */
  framed: boolean | null;
  /** names from "Художник:" / "Зограф:" / "Автор:" */
  artistMentions: string[];
  /** removed mentions of the authenticity certificate (§4.3: not issued) */
  removedCertificate: string[];
}

const NAMED: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  bdquo: "„",
  ldquo: "“",
  rdquo: "”",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const HEADING = "\u0001"; // marker prefix for heading lines

/** HTML or plain text → trimmed lines; "" marks a paragraph break; headings are prefixed. */
export function toLines(input: string): string[] {
  let s = input.replace(/\r\n?/g, "\n");
  s = s.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_m, inner: string) => `\n\n${HEADING}${inner.replace(/\n/g, " ")}\n\n`);
  // a paragraph that is only bold text is a heading ("<p><strong>Материали и техника</strong></p>")
  s = s.replace(/<p[^>]*>\s*<(strong|b)[^>]*>([^<]{2,60})<\/\1>\s*<\/p>/gi, (_m, _t, inner: string) =>
    /:\s*$/.test(inner) ? `\n${inner}\n` : `\n\n${HEADING}${inner}\n\n`,
  );
  s = s
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<br\b[^>]*>/gi, "\n")
    .replace(/<\/(p|div|li|ul|ol|h\d)>/gi, "\n\n")
    .replace(/<(p|div|ul|ol)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  const out: string[] = [];
  for (const raw of s.split("\n")) {
    const line = raw.replace(/[\t  ]+/g, " ").trim();
    if (!line) {
      if (out.length && out[out.length - 1] !== "") out.push("");
      continue;
    }
    out.push(line);
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out;
}

type SpecKind = "size" | "technique" | "materials" | "artist" | "framed" | "drop";

function specKind(label: string): SpecKind | null {
  const l = label.toLowerCase().replace(/\s+/g, " ").trim();
  if (/^(размер|рамер|външен размер)/.test(l)) return "size";
  if (l === "техника") return "technique";
  if (l === "материали") return "materials";
  if (/^(художник|зограф|автор|автор на оригинала)$/.test(l)) return "artist";
  if (/^(рамкирана и подписана|рамка|с рамка и стъкло|рамкирана)$/.test(l)) return "framed";
  if (/^(сертификат|се?тификат|доставка|категория|вид)$/.test(l)) return "drop";
  return null;
}

/** Old shop texts that the new site shows in its own trust/contact blocks (or that are no longer true). */
const BOILERPLATE = [
  /^[✓✔]/u,
  /не се колебайте да/iu,
  /безплатна доставка/iu,
  /работни дни/iu,
  /връщане или замяна/iu,
  /^тел\.?\s*:/iu,
  /^e-?mail\s*:/iu,
  /^галерия\s*:/iu,
  /посещение с предварителна уговорка/iu,
  /^за повече информация/iu,
  /благодарим за посещението/iu,
  /^ако търсите оригинални/iu,
  /^изработваме и персонализирани икони/iu,
];

const CERT = /се?р?тификат/iu;

/**
 * Removes the certificate from a line: a "+ … сертификат" segment is cut,
 * a sentence that mentions it is dropped, a "•"-list line loses that item.
 */
export function removeCertificate(line: string): string {
  if (line.includes("•")) {
    return line
      .split("•")
      .map((part) => part.trim())
      .filter((part) => part && !CERT.test(part))
      .join(" • ");
  }
  const sentences = line.split(/(?<=[.!?])\s+/u);
  return sentences
    .map((sentence) => {
      if (!CERT.test(sentence)) return sentence;
      if (sentence.includes(" + ")) {
        return sentence
          .split(" + ")
          .filter((seg) => !CERT.test(seg))
          .join(" + ");
      }
      return "";
    })
    .filter(Boolean)
    .join(" ")
    .trim();
}

function isDimensionsOnly(line: string): boolean {
  return /^\d{1,3}([.,]\d{1,2})?\s*[/xXхХ×]\s*\d/.test(line);
}

/** Cleans one source (excerpt or content). */
export function cleanLegacyText(input: string): CleanedText {
  const lines = toLines(input);
  const result: CleanedText = {
    html: "",
    narrativeChars: 0,
    technique: null,
    materials: null,
    sizeLines: [],
    framed: null,
    artistMentions: [],
    removedCertificate: [],
  };

  type Block = { type: "h"; text: string } | { type: "p"; lines: string[] } | { type: "ul"; items: string[] };
  const blocks: Block[] = [];
  let current: Block | null = null;
  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]!;
    if (line === "") {
      flush();
      continue;
    }
    if (line.startsWith(HEADING)) {
      flush();
      blocks.push({ type: "h", text: line.slice(1).trim().replace(/:$/, "") });
      continue;
    }
    if (BOILERPLATE.some((re) => re.test(line))) {
      if (CERT.test(line)) result.removedCertificate.push(line);
      continue;
    }

    const bullet = /^[•·\-*]\s*/.test(line);
    const body = line.replace(/^[•·\-*]\s*/, "");
    const spec = /^([^:]{2,40}):\s*(.*)$/u.exec(body);
    const kind = spec ? specKind(spec[1]!) : null;
    if (spec && kind) {
      let value = spec[2]!.trim();
      if (kind === "size" && !value && i + 1 < lines.length && isDimensionsOnly(lines[i + 1]!)) value = lines[++i]!;
      switch (kind) {
        case "size":
          result.sizeLines.push(`${spec[1]!.trim()}: ${value}`);
          break;
        case "technique":
          result.technique ??= value || null;
          break;
        case "materials":
          result.materials ??= value || null;
          break;
        case "artist":
          if (value) result.artistMentions.push(value);
          break;
        case "framed":
          if (/^да/i.test(value)) result.framed = true;
          else if (/^не/i.test(value)) result.framed ??= false;
          break;
        case "drop":
          if (CERT.test(spec[1]!)) result.removedCertificate.push(line);
          break;
      }
      continue;
    }
    if (isDimensionsOnly(body) && body.length < 30) {
      result.sizeLines.push(body);
      continue;
    }

    if (CERT.test(line)) {
      result.removedCertificate.push(line);
      line = removeCertificate(line);
      if (!line) continue;
    }

    const text = (bullet ? body : line).trim();
    if (bullet) {
      if (current?.type !== "ul") {
        flush();
        current = { type: "ul", items: [] };
      }
      current.items.push(text);
    } else {
      if (current?.type !== "p") {
        flush();
        current = { type: "p", lines: [] };
      }
      current.lines.push(text);
    }
  }
  flush();

  // headings with nothing after them (their spec lines were extracted) go away
  const kept = blocks.filter((b, idx) => b.type !== "h" || (blocks[idx + 1] !== undefined && blocks[idx + 1]!.type !== "h"));

  result.html = kept
    .map((b) => {
      if (b.type === "h") return `<h3>${escapeHtml(b.text)}</h3>`;
      if (b.type === "ul") return `<ul>${b.items.map((it) => `<li>${escapeHtml(it)}</li>`).join("")}</ul>`;
      return `<p>${b.lines.map(escapeHtml).join("<br>")}</p>`;
    })
    .join("\n");
  result.narrativeChars = kept.reduce((n, b) => n + (b.type === "p" ? b.lines.join(" ").length : 0), 0);
  return result;
}

function words(html: string): Set<string> {
  return new Set(
    html
      .replace(/<[^>]+>/g, " ")
      .toLowerCase()
      .split(/[^\p{L}\d]+/u)
      .filter((w) => w.length > 3),
  );
}

/** Word overlap of two texts (Jaccard), 0–1. */
export function similarity(a: string, b: string): number {
  const A = words(a);
  const B = words(b);
  if (A.size === 0 || B.size === 0) return 0;
  let common = 0;
  for (const w of A) if (B.has(w)) common++;
  return common / (A.size + B.size - common);
}

/**
 * Combines the short description (excerpt) and the long one (content):
 * spec fields from both (excerpt first); the text from both unless they say
 * the same thing, in which case the longer one is kept.
 */
export function combineLegacyTexts(excerpt: string, content: string): CleanedText & { textSource: "excerpt" | "content" | "both" | "none" } {
  const a = cleanLegacyText(excerpt);
  const b = cleanLegacyText(content);
  const merged: CleanedText = {
    html: "",
    narrativeChars: 0,
    technique: a.technique ?? b.technique,
    materials: a.materials ?? b.materials,
    sizeLines: [...new Set([...a.sizeLines, ...b.sizeLines])],
    framed: a.framed ?? b.framed,
    artistMentions: [...new Set([...a.artistMentions, ...b.artistMentions])],
    removedCertificate: [...a.removedCertificate, ...b.removedCertificate],
  };
  let textSource: "excerpt" | "content" | "both" | "none";
  const hasA = a.html.trim() !== "";
  const hasB = b.html.trim() !== "" && b.narrativeChars > 0;
  if (hasA && hasB) {
    if (similarity(a.html, b.html) >= 0.15) {
      textSource = a.narrativeChars >= b.narrativeChars ? "excerpt" : "content";
    } else textSource = "both";
  } else textSource = hasA ? "excerpt" : hasB ? "content" : "none";

  merged.html = textSource === "both" ? `${a.html}\n${b.html}` : textSource === "excerpt" ? a.html : textSource === "content" ? b.html : "";
  merged.narrativeChars =
    textSource === "both" ? a.narrativeChars + b.narrativeChars : textSource === "excerpt" ? a.narrativeChars : textSource === "content" ? b.narrativeChars : 0;
  return { ...merged, textSource };
}
