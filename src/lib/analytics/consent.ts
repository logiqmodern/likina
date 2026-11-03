/*
 * Cookie consent (§9.1). One first-party cookie holds the choice; it is read
 * by the browser (to load / not load GA4, Meta Pixel, Google Ads) and by the
 * server (Meta Conversions API is sent only with marketing consent).
 * Pure — safe in client and server code.
 *
 * Format: "<version>.<analytics 0|1>.<marketing 0|1>.<unix seconds>.<id>"
 * The id (random, no personal data) links the cookie to the stored record of
 * the choice (consent_records) — proof of consent (GDPR art. 7(1)).
 */

export const CONSENT_COOKIE = "lio_consent";
/** Bump when the categories or the tools behind them change → everyone is asked again. */
export const CONSENT_VERSION = 1;
/** Ask again after ~6 months. */
export const CONSENT_MAX_AGE_S = 182 * 24 * 3600;

export interface Consent {
  version: number;
  analytics: boolean;
  marketing: boolean;
  /** when the choice was made */
  at: Date;
  id: string;
}

const ID = /^[A-Za-z0-9_-]{8,64}$/;

export function parseConsent(value: string | null | undefined): Consent | null {
  if (!value) return null;
  const parts = decodeURIComponent(value).split(".");
  if (parts.length !== 5) return null;
  const [v, a, m, ts, id] = parts as [string, string, string, string, string];
  const version = Number(v);
  const seconds = Number(ts);
  if (!Number.isInteger(version) || version !== CONSENT_VERSION) return null; // old version → ask again
  if ((a !== "0" && a !== "1") || (m !== "0" && m !== "1")) return null;
  if (!Number.isInteger(seconds) || seconds <= 0 || !ID.test(id)) return null;
  return { version, analytics: a === "1", marketing: m === "1", at: new Date(seconds * 1000), id };
}

export function serializeConsent(c: Pick<Consent, "analytics" | "marketing" | "at" | "id">): string {
  return [CONSENT_VERSION, c.analytics ? 1 : 0, c.marketing ? 1 : 0, Math.floor(c.at.getTime() / 1000), c.id].join(".");
}

/** Google Consent Mode v2 state for a choice (null = not decided yet → everything denied). */
export function googleConsentState(c: Pick<Consent, "analytics" | "marketing"> | null) {
  const a = c?.analytics ? "granted" : "denied";
  const m = c?.marketing ? "granted" : "denied";
  return {
    analytics_storage: a,
    ad_storage: m,
    ad_user_data: m,
    ad_personalization: m,
  } as const;
}

/** Reads one cookie from a `document.cookie` / Cookie header string. */
export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}
