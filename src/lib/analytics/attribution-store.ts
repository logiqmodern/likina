import {
  ATTR_COOKIE,
  ATTR_MAX_AGE_S,
  ATTR_STORAGE_KEY,
  type Attribution,
  attributionFromUrl,
  LANDING_STORAGE_KEY,
  landingPath,
  newerAttribution,
  parseAttribution,
  type ResolvedAttribution,
  resolveAttribution,
  serializeAttribution,
} from "./attribution";
import type { Consent } from "./consent";
import { readCookie } from "./consent";

/*
 * Browser side of the attribution record (see ./attribution.ts). Storage can
 * be blocked (private mode, cookies off): everything here is best effort.
 */

function session(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function sessionGet(key: string): string | null {
  try {
    return session()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function sessionSet(key: string, value: string): void {
  try {
    session()?.setItem(key, value);
  } catch {
    // quota / blocked
  }
}

function readAttrCookie(): Attribution | null {
  return parseAttribution(readCookie(document.cookie, ATTR_COOKIE));
}

function writeAttrCookie(a: Attribution): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ATTR_COOKIE}=${serializeAttribution(a)}; Max-Age=${ATTR_MAX_AGE_S}; Path=/; SameSite=Lax${secure}`;
}

/**
 * First page view of a document: on the first page of the tab session store
 * the landing path and, if the URL carries campaign parameters, the campaign.
 * With analytics or marketing consent the campaign also goes to the 30-day
 * cookie (latest campaign visit wins).
 */
export function captureAttribution(consent: Consent | null): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const fromUrl = attributionFromUrl(window.location.search, window.location.pathname, now);
  if (sessionGet(LANDING_STORAGE_KEY) === null) {
    sessionSet(LANDING_STORAGE_KEY, landingPath(window.location.pathname));
    if (fromUrl) sessionSet(ATTR_STORAGE_KEY, serializeAttribution(fromUrl));
  }
  if (fromUrl && (consent?.analytics || consent?.marketing)) writeAttrCookie(fromUrl);
}

/** After consent is given: keep this session's campaign in the cookie unless the cookie holds a newer one. */
export function persistAttribution(consent: Consent | null): void {
  if (typeof window === "undefined" || !(consent?.analytics || consent?.marketing)) return;
  const fromSession = parseAttribution(sessionGet(ATTR_STORAGE_KEY));
  if (!fromSession) return;
  const cookie = readAttrCookie();
  const newer = newerAttribution(cookie, fromSession);
  if (newer && newer !== cookie) writeAttrCookie(newer);
}

/** For the booking flow: URL parameters > this tab session > the 30-day cookie. */
export function readAttribution(search: URLSearchParams): ResolvedAttribution {
  return resolveAttribution({
    url: attributionFromUrl(search, window.location.pathname, Date.now()),
    session: parseAttribution(sessionGet(ATTR_STORAGE_KEY)),
    cookie: readAttrCookie(),
    sessionLanding: sessionGet(LANDING_STORAGE_KEY),
  });
}

/** Runs `fn` once per tab session for `key` (e.g. the anonymous "booking started" counter). */
export function oncePerSession(key: string, fn: () => void): void {
  const k = `lio_once:${key}`;
  if (doneInMemory.has(k) || sessionGet(k) !== null) return;
  doneInMemory.add(k); // storage may be blocked: at least once per page
  sessionSet(k, "1");
  fn();
}

const doneInMemory = new Set<string>();
