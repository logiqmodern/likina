/*
 * Automatic translation with the Claude API (§7). ANTHROPIC_API_KEY in the
 * environment; without it nothing is translated and /en shows the BG text.
 */

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

const SYSTEM = {
  "bg>en": [
    "You translate texts for the website of Likina, a Bulgarian family atelier selling hand-painted Orthodox icons and paintings, from Bulgarian into natural British English.",
    "Rules: keep every HTML tag and attribute exactly as it is; translate only the text.",
    "Use the established English names of saints and feasts (e.g. „Св. Николай Чудотворец“ → „St Nicholas the Wonderworker“, „Богородица Умиление“ → „Virgin of Tenderness (Eleusa)“).",
    "Never translate personal names: Гергана Никифорова → Gergana Nikiforova, Румен Божинов → Rumen Bozhinov.",
    "Do not add facts, claims or words of praise that are not in the original.",
    "Answer with a single JSON object with exactly the same keys as the input and the translations as values. No other text.",
  ].join("\n"),
  "en>bg": [
    "You translate short customer reviews for the website of Likina, a Bulgarian art atelier, from English into natural Bulgarian.",
    "Keep the meaning and tone; do not add anything. Keep emoji as they are. The artist „Gery“ stays „Гери“.",
    "Answer with a single JSON object with exactly the same keys as the input and the translations as values. No other text.",
  ].join("\n"),
} as const;

export function parseTranslation(text: string, keys: string[]): Record<string, string> | null {
  const json = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  try {
    const data = JSON.parse(json) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const k of keys) {
      if (typeof data[k] !== "string" || !(data[k] as string).trim()) return null;
      out[k] = (data[k] as string).trim();
    }
    return out;
  } catch {
    return null;
  }
}

/** Translates the non-empty fields; null on any API or format error (the caller retries later). */
export async function translateFields(
  fields: Record<string, string | null | undefined>,
  direction: "bg>en" | "en>bg",
  opts: { apiKey: string; model?: string; fetch?: FetchLike },
): Promise<Record<string, string> | null> {
  const input = Object.fromEntries(Object.entries(fields).filter((e): e is [string, string] => typeof e[1] === "string" && e[1].trim() !== ""));
  const keys = Object.keys(input);
  if (keys.length === 0) return {};
  const res = await (opts.fetch ?? fetch)("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: opts.model ?? "claude-sonnet-5-5",
      max_tokens: 8000,
      system: SYSTEM[direction],
      messages: [{ role: "user", content: JSON.stringify(input) }],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    console.warn(`[translate] API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return null;
  }
  const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = body.content?.find((c) => c.type === "text")?.text ?? "";
  return parseTranslation(text, keys);
}
