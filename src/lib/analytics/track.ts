import { getAnalyticsConfig } from "./config";
import { type Consent } from "./consent";
import { EVENT_ROUTES, type EventName, type EventParams } from "./events";
import { readConsent, syncTrackers } from "./loader";
import { isSensitivePath } from "./privacy";

export { setAnalyticsConfig } from "./config";
export type { PublicAnalyticsConfig } from "./public-config";

/*
 * Browser side of the event catalogue. Sends to whatever the visitor allowed:
 * GA4 (analytics), Meta Pixel + Google Ads (marketing). Without consent it
 * does nothing — the funnel in the admin is built from our own data instead.
 * The trackers are loaded by ./loader.ts (src/components/analytics/analytics-provider.tsx)
 * only after consent; track() makes sure they are set up before sending.
 * Never put personal data (names, phones, e-mails) in the params.
 */

type Gtag = (...args: unknown[]) => void;
type Fbq = ((...args: unknown[]) => void) & { callMethod?: unknown };

declare global {
  interface Window {
    gtag?: Gtag;
    dataLayer?: unknown[];
    fbq?: Fbq;
  }
}

export function currentConsent(): Consent | null {
  return readConsent();
}

/**
 * Sends one event. `eventId` deduplicates the Pixel event against the
 * server-side Conversions API call (same id on both sides).
 */
export function track(event: EventName, params: EventParams = {}, opts: { eventId?: string } = {}): void {
  if (typeof window === "undefined") return;
  const consent = currentConsent();
  if (!consent) return;
  const config = getAnalyticsConfig();
  const route = EVENT_ROUTES[event];
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined));

  try {
    syncTrackers(consent);
    if (consent.analytics && config.ga4Id && window.gtag) {
      window.gtag("event", event, { ...clean, send_to: config.ga4Id });
    }
    if (consent.marketing) {
      if (route.meta.length > 0 && config.metaPixelId && window.fbq && !isSensitivePath(window.location.pathname)) {
        const metaParams: Record<string, unknown> = {};
        if (typeof clean.value === "number") {
          metaParams.value = clean.value;
          metaParams.currency = clean.currency ?? "EUR";
        }
        if (typeof clean.item_name === "string") metaParams.content_name = clean.item_name;
        if (typeof clean.service === "string") metaParams.content_name = clean.service;
        for (const name of route.meta) {
          window.fbq("track", name, metaParams, opts.eventId ? { eventID: opts.eventId } : undefined);
        }
      }
      const label = route.ads ? config.adsLabels[route.ads] : undefined;
      if (label && config.adsId && window.gtag) {
        window.gtag("event", "conversion", {
          send_to: `${config.adsId}/${label}`,
          ...(typeof clean.value === "number" ? { value: clean.value, currency: clean.currency ?? "EUR" } : {}),
          ...(typeof clean.transaction_id === "string" ? { transaction_id: clean.transaction_id } : {}),
        });
      }
    }
  } catch {
    // Analytics must never break the page.
  }
}

/** Fires an event once per browser for a given key (e.g. a booking id on the confirmation page). */
export function trackOnce(key: string, event: EventName, params: EventParams = {}, opts: { eventId?: string } = {}): void {
  try {
    const k = `lio_tracked:${key}`;
    if (window.localStorage.getItem(k)) return;
    window.localStorage.setItem(k, "1");
  } catch {
    // storage blocked: send anyway (duplicates are deduplicated by transaction_id / eventID)
  }
  track(event, params, opts);
}
