/*
 * Public measurement ids (NEXT_PUBLIC_*). They are inlined into the browser
 * bundle at build time; an empty or malformed id means that tool is simply
 * not loaded. Ids end up in script URLs and gtag/fbq calls, so they are
 * checked against their known formats. Pure — client and server.
 */

export type AdsLabelKey = "booking" | "lead" | "phone";

export interface PublicAnalyticsConfig {
  /** GA4 measurement id, "G-XXXXXXX" */
  ga4Id: string | null;
  /** Meta Pixel id (digits) */
  metaPixelId: string | null;
  /** Google Ads tag id, "AW-123456789" */
  adsId: string | null;
  /** Google Ads conversion labels per conversion */
  adsLabels: Partial<Record<AdsLabelKey, string>>;
}

const GA4_ID = /^G-[A-Z0-9]{4,20}$/;
const ADS_ID = /^AW-\d{6,15}$/;
const PIXEL_ID = /^\d{6,20}$/;
const ADS_LABEL = /^[A-Za-z0-9_-]{4,64}$/;

function pick(value: string | undefined, format: RegExp): string | null {
  const v = value?.trim();
  return v && format.test(v) ? v : null;
}

export function parsePublicAnalyticsConfig(env: Record<string, string | undefined>): PublicAnalyticsConfig {
  const adsLabels: Partial<Record<AdsLabelKey, string>> = {};
  const labels: Array<[AdsLabelKey, string | undefined]> = [
    ["booking", env.NEXT_PUBLIC_GOOGLE_ADS_BOOKING_LABEL],
    ["lead", env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL],
    ["phone", env.NEXT_PUBLIC_GOOGLE_ADS_PHONE_LABEL],
  ];
  for (const [key, value] of labels) {
    const label = pick(value, ADS_LABEL);
    if (label) adsLabels[key] = label;
  }
  return {
    ga4Id: pick(env.NEXT_PUBLIC_GA4_ID, GA4_ID),
    metaPixelId: pick(env.NEXT_PUBLIC_META_PIXEL_ID, PIXEL_ID),
    adsId: pick(env.NEXT_PUBLIC_GOOGLE_ADS_ID, ADS_ID),
    adsLabels,
  };
}

/** The ids of this build. Each variable is read literally so Next.js can inline it. */
export function publicAnalyticsConfig(): PublicAnalyticsConfig {
  return parsePublicAnalyticsConfig({
    NEXT_PUBLIC_GA4_ID: process.env.NEXT_PUBLIC_GA4_ID,
    NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID,
    NEXT_PUBLIC_GOOGLE_ADS_ID: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
    NEXT_PUBLIC_GOOGLE_ADS_BOOKING_LABEL: process.env.NEXT_PUBLIC_GOOGLE_ADS_BOOKING_LABEL,
    NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL: process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL,
    NEXT_PUBLIC_GOOGLE_ADS_PHONE_LABEL: process.env.NEXT_PUBLIC_GOOGLE_ADS_PHONE_LABEL,
  });
}
