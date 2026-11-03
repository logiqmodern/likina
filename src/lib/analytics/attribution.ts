/*
 * Ad attribution (§9.3): which campaign brought the visitor. Captured on the
 * first page view of a tab session (sessionStorage) and, with analytics or
 * marketing consent, kept in a first-party cookie for 30 days (the latest
 * campaign visit wins). The booking flow sends it with the hold.
 * Pure — the browser glue is in ./attribution-store.ts.
 */

export const ATTR_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"] as const;
export type AttrKey = (typeof ATTR_KEYS)[number];

/** sessionStorage + cookie name of the campaign record */
export const ATTR_STORAGE_KEY = "lio_attr";
export const ATTR_COOKIE = "lio_attr";
/** sessionStorage: first page of this tab session */
export const LANDING_STORAGE_KEY = "lio_landing";
export const ATTR_MAX_AGE_S = 30 * 24 * 3600;

/** Same limits as the hold action (src/app/(booking)/_actions/booking.ts). */
const MAX_LENGTH: Record<AttrKey, number> = {
  utm_source: 200,
  utm_medium: 200,
  utm_campaign: 200,
  utm_content: 200,
  utm_term: 200,
  fbclid: 500,
  gclid: 500,
};
const LANDING_MAX = 200;

export interface Attribution {
  params: Partial<Record<AttrKey, string>>;
  /** landing path of the campaign visit (no query string) */
  landing: string;
  /** when the campaign visit happened (ms) */
  at: number;
}

/** Same shape as AttributionInput of the hold action. */
export interface ResolvedAttribution {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  fbclid: string | null;
  gclid: string | null;
  landingPage: string | null;
}

function cleanValue(key: AttrKey, value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v || v.length > MAX_LENGTH[key]) return null;
  return v;
}

/** "/oferta/x?utm_source=…" → "/oferta/x" (clipped). */
export function landingPath(pathname: string): string {
  const p = pathname.split(/[?#]/)[0] || "/";
  return (p.startsWith("/") ? p : `/${p}`).slice(0, LANDING_MAX);
}

/** The campaign record of a URL, or null when it carries no utm_* / fbclid / gclid. */
export function attributionFromUrl(search: string | URLSearchParams, pathname: string, now: number): Attribution | null {
  const sp = typeof search === "string" ? new URLSearchParams(search) : search;
  const params: Attribution["params"] = {};
  for (const key of ATTR_KEYS) {
    const v = cleanValue(key, sp.get(key));
    if (v) params[key] = v;
  }
  if (Object.keys(params).length === 0) return null;
  return { params, landing: landingPath(pathname), at: now };
}

export function serializeAttribution(a: Attribution): string {
  return encodeURIComponent(JSON.stringify({ p: a.params, l: a.landing, t: a.at }));
}

/** Tolerant parse of a stored record (cookie or sessionStorage); anything odd → null. */
export function parseAttribution(raw: string | null | undefined): Attribution | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const { p, l, t } = data as { p?: unknown; l?: unknown; t?: unknown };
  if (!p || typeof p !== "object" || typeof l !== "string" || typeof t !== "number" || !Number.isFinite(t)) return null;
  const params: Attribution["params"] = {};
  for (const key of ATTR_KEYS) {
    const v = cleanValue(key, (p as Record<string, unknown>)[key]);
    if (v) params[key] = v;
  }
  if (Object.keys(params).length === 0) return null;
  return { params, landing: landingPath(l), at: t };
}

/** Latest campaign visit wins; a missing record never replaces an existing one. */
export function newerAttribution(a: Attribution | null, b: Attribution | null): Attribution | null {
  if (!a) return b;
  if (!b) return a;
  return b.at >= a.at ? b : a;
}

/**
 * What the booking flow sends with the hold: the URL's own parameters first,
 * then this tab session's campaign, then the 30-day cookie. One record is used
 * as a whole (campaigns are never mixed). The landing page belongs to that
 * record; without a record it is the first page of this session.
 */
export function resolveAttribution(input: {
  url: Attribution | null;
  session: Attribution | null;
  cookie: Attribution | null;
  sessionLanding: string | null;
}): ResolvedAttribution {
  const record = input.url ?? input.session ?? input.cookie;
  const landing = input.url ? (input.sessionLanding ?? input.url.landing) : (record?.landing ?? input.sessionLanding);
  const p = record?.params ?? {};
  return {
    utmSource: p.utm_source ?? null,
    utmMedium: p.utm_medium ?? null,
    utmCampaign: p.utm_campaign ?? null,
    utmContent: p.utm_content ?? null,
    utmTerm: p.utm_term ?? null,
    fbclid: p.fbclid ?? null,
    gclid: p.gclid ?? null,
    landingPage: landing ? landingPath(landing) : null,
  };
}
