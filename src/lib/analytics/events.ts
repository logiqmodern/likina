/*
 * Event catalogue (§9.3). Names are constants; the table says where each one
 * goes. GA4 needs analytics consent, Meta Pixel / Google Ads need marketing
 * consent. Pure — client and server.
 */

export const EVENTS = {
  viewService: "view_service",
  bookingStart: "booking_start",
  slotSelected: "slot_selected",
  bookingDetailsSubmitted: "booking_details_submitted",
  bookingConfirmed: "booking_confirmed",
  holdExpired: "hold_expired",
  clickPhone: "click_phone",
  inquirySubmitted: "inquiry_submitted",
  bookingCancelled: "booking_cancelled",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export type MetaEventName = "ViewContent" | "InitiateCheckout" | "Schedule" | "Contact" | "Lead";
export type AdsConversion = "booking" | "lead" | "phone";

export interface EventRoute {
  /** mark as key event in GA4 (Admin → Events), listed here for the docs */
  ga4KeyEvent: boolean;
  /**
   * Meta standard events to send (Pixel and, if `metaCapi`, the server).
   * A confirmed booking goes out as Lead + Schedule: the running campaign
   * optimises on Lead (kept since the WordPress site), Schedule builds the
   * history for a later switch. Meta deduplicates per event name + event_id,
   * so one id serves both. See docs/adr/0004-measurement.md.
   */
  meta: readonly MetaEventName[];
  /** also sent from the server (Conversions API) with the same event_id */
  metaCapi: boolean;
  /** Google Ads conversion label key (see NEXT_PUBLIC_GOOGLE_ADS_*_LABEL) */
  ads: AdsConversion | null;
}

export const EVENT_ROUTES: Record<EventName, EventRoute> = {
  view_service: { ga4KeyEvent: false, meta: ["ViewContent"], metaCapi: false, ads: null },
  // a service chosen in the booking flow: a mid-funnel signal for Meta (browser only, no personal data yet)
  booking_start: { ga4KeyEvent: false, meta: ["InitiateCheckout"], metaCapi: false, ads: null },
  slot_selected: { ga4KeyEvent: false, meta: [], metaCapi: false, ads: null },
  booking_details_submitted: { ga4KeyEvent: false, meta: [], metaCapi: false, ads: null },
  booking_confirmed: { ga4KeyEvent: true, meta: ["Lead", "Schedule"], metaCapi: true, ads: "booking" },
  hold_expired: { ga4KeyEvent: false, meta: [], metaCapi: false, ads: null },
  click_phone: { ga4KeyEvent: true, meta: ["Contact"], metaCapi: false, ads: "phone" },
  inquiry_submitted: { ga4KeyEvent: true, meta: ["Lead"], metaCapi: true, ads: "lead" },
  booking_cancelled: { ga4KeyEvent: false, meta: [], metaCapi: false, ads: null },
};

export type EventParams = Record<string, string | number | boolean | undefined | Array<Record<string, string | number>>>;

/** Shared event id for the browser Pixel and the server CAPI call (deduplication). */
export function metaEventId(event: EventName, entityId: string): string {
  return `${event}:${entityId}`;
}

/** GA4 ecommerce-style params for a confirmed booking. */
export function bookingConfirmedParams(b: { bookingId: string; serviceSlug: string; serviceName: string; valueCents: number }) {
  const value = Math.round(b.valueCents) / 100;
  return {
    transaction_id: b.bookingId,
    value,
    currency: "EUR",
    items: [{ item_id: b.serviceSlug, item_name: b.serviceName, price: value, quantity: 1 }],
  };
}
