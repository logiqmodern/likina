import { ATTR_COOKIE } from "./attribution";
import { getAnalyticsConfig } from "./config";
import { type Consent, CONSENT_COOKIE, googleConsentState, parseConsent, readCookie } from "./consent";
import { expireCookieAssignments, isSensitivePath, safePageLocation, trackerCookiesToDelete } from "./privacy";

/*
 * Browser loader for GA4, Google Ads (one gtag.js) and the Meta Pixel.
 * Google Consent Mode v2 "basic": the default (everything denied) is defined
 * first, and no Google or Meta script is requested before the visitor agrees.
 * Every function is idempotent — the provider, the page-view tracker and
 * track() may all call syncTrackers(); whoever comes first sets things up.
 * Never imported by the admin.
 */

declare global {
  interface Window {
    _fbq?: unknown;
    /** set once the Consent Mode default has been pushed */
    __lioCmDefault?: boolean;
  }
}

const GTAG_SRC = "https://www.googletagmanager.com/gtag/js";
const PIXEL_SRC = "https://connect.facebook.net/en_US/fbevents.js";

const loaded = { gtagScript: false, consentKey: "", ga4: false, ads: false, pixel: false };
/** page currently shown (pathname) and the last one reported to each tool */
let viewedPath: string | null = null;
const reported = { ga4: null as string | null, pixel: null as string | null };
/** document.title of the page shown last (a client navigation updates it a moment later) */
let shownTitle = "";

export function readConsent(): Consent | null {
  if (typeof document === "undefined") return null;
  return parseConsent(readCookie(document.cookie, CONSENT_COOKIE));
}

/** Runs `fn` when the browser is idle (keeps third-party scripts off the LCP path). */
function whenIdle(fn: () => void): void {
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(fn, { timeout: 3000 });
  else window.setTimeout(fn, 1);
}

function injectScript(src: string): void {
  whenIdle(() => {
    const s = document.createElement("script");
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  });
}

/** dataLayer + gtag stub + the Consent Mode default (all denied) before the first Google command. */
function ensureGtagStub(): (...args: unknown[]) => void {
  window.dataLayer = window.dataLayer ?? [];
  if (!window.gtag) {
    window.gtag = function gtag() {
      // gtag.js expects the Arguments object itself.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
  }
  if (!window.__lioCmDefault) {
    window.__lioCmDefault = true;
    window.gtag("consent", "default", { ...googleConsentState(null), wait_for_update: 500 });
  }
  return window.gtag;
}

function ensurePixelStub(): void {
  if (window.fbq) return;
  type Queue = ((...args: unknown[]) => void) & {
    callMethod?: (...args: unknown[]) => void;
    queue: unknown[];
    push: unknown;
    loaded: boolean;
    version: string;
  };
  const n = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod(...args);
    else n.queue.push(args);
  } as Queue;
  n.queue = [];
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  window.fbq = n;
  if (!window._fbq) window._fbq = n;
  injectScript(PIXEL_SRC);
}

function flushPageView(): void {
  if (!viewedPath) return;
  const { ga4Id } = getAnalyticsConfig();
  try {
    if (loaded.ga4 && ga4Id && window.gtag && reported.ga4 !== viewedPath) {
      const location = safePageLocation(window.location.href);
      window.gtag("set", { page_location: location });
      window.gtag("event", "page_view", { page_location: location, page_title: document.title, send_to: ga4Id });
      reported.ga4 = viewedPath;
    }
    if (loaded.pixel && window.fbq && reported.pixel !== viewedPath && !isSensitivePath(window.location.pathname)) {
      window.fbq("track", "PageView");
      reported.pixel = viewedPath;
    }
  } catch {
    // Analytics must never break the page.
  }
}

/**
 * Loads and configures whatever `consent` allows (never unloads — a withdrawal
 * reloads the page, see withdrawConsent). Then reports the current page view
 * to the tools that were just set up.
 */
export function syncTrackers(consent: Consent | null): void {
  if (typeof window === "undefined" || !consent) return;
  const c = getAnalyticsConfig();
  const wantGa4 = consent.analytics && !!c.ga4Id;
  const wantAds = consent.marketing && !!c.adsId;
  const wantPixel = consent.marketing && !!c.metaPixelId;

  try {
    if (wantGa4 || wantAds) {
      const gtag = ensureGtagStub();
      const key = `${consent.analytics ? 1 : 0}${consent.marketing ? 1 : 0}`;
      if (loaded.consentKey !== key) {
        gtag("consent", "update", googleConsentState(consent));
        loaded.consentKey = key;
      }
      if (!loaded.gtagScript) {
        gtag("js", new Date());
        injectScript(`${GTAG_SRC}?id=${encodeURIComponent((wantGa4 ? c.ga4Id : c.adsId) as string)}`);
        loaded.gtagScript = true;
      }
      if ((wantGa4 && !loaded.ga4) || (wantAds && !loaded.ads)) {
        // The referrer can be the manage page (/rezervaciya/<token>) — mask it like the location.
        gtag("set", {
          page_location: safePageLocation(window.location.href),
          ...(document.referrer ? { page_referrer: safePageLocation(document.referrer) } : {}),
        });
      }
      if (wantGa4 && !loaded.ga4) {
        gtag("config", c.ga4Id, { send_page_view: false });
        loaded.ga4 = true;
      }
      if (wantAds && !loaded.ads) {
        gtag("config", c.adsId, { send_page_view: false });
        loaded.ads = true;
      }
    }
    // The Pixel reads the page URL itself: never started on a page with a secret in it.
    if (wantPixel && !loaded.pixel && !isSensitivePath(window.location.pathname)) {
      ensurePixelStub();
      window.fbq!("init", c.metaPixelId);
      loaded.pixel = true;
    }
  } catch {
    // Analytics must never break the page.
  }
  flushPageView();
}

/**
 * Calls `fn` once the new page's <title> is in place: after a client-side
 * navigation the metadata may stream in after the page itself (max 1 s).
 */
function whenTitleSettles(previous: string, fn: () => void): void {
  const ready = () => document.title !== "" && document.title !== previous;
  if (ready()) return fn();
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    observer.disconnect();
    window.clearTimeout(timer);
    fn();
  };
  const observer = new MutationObserver(() => {
    if (ready()) finish();
  });
  observer.observe(document.head, { subtree: true, childList: true, characterData: true });
  const timer = window.setTimeout(finish, 1000);
}

/** A page was shown (first load or client-side navigation). */
export function pageView(pathname: string): void {
  if (typeof window === "undefined") return;
  syncTrackers(readConsent());
  whenTitleSettles(shownTitle, () => {
    viewedPath = pathname;
    shownTitle = document.title;
    flushPageView();
  });
}

/** Which categories went from "yes" to "no". */
export function withdrawnCategories(prev: Pick<Consent, "analytics" | "marketing"> | null, next: Pick<Consent, "analytics" | "marketing">) {
  return { analytics: !!prev?.analytics && !next.analytics, marketing: !!prev?.marketing && !next.marketing };
}

/**
 * Consent withdrawn: delete the cookies the tools left on this site (host and
 * registrable domain) and reload so their scripts are gone.
 * Returns false when nothing was withdrawn (nothing done).
 */
export function withdrawConsent(prev: Pick<Consent, "analytics" | "marketing"> | null, next: Pick<Consent, "analytics" | "marketing">): boolean {
  const withdrawn = withdrawnCategories(prev, next);
  if (!withdrawn.analytics && !withdrawn.marketing) return false;
  const names = trackerCookiesToDelete(document.cookie, withdrawn);
  // The 30-day campaign cookie is kept only with analytics or marketing consent.
  if (!next.analytics && !next.marketing) names.push(ATTR_COOKIE);
  for (const name of names) {
    for (const assignment of expireCookieAssignments(name, window.location.hostname)) document.cookie = assignment;
  }
  window.location.reload();
  return true;
}
