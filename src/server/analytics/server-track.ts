import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { CONSENT_COOKIE, parseConsent } from "@/lib/analytics/consent";
import { EVENT_ROUTES, type EventName } from "@/lib/analytics/events";
import { serverEnv } from "@/lib/env";
import { fbcValue, sendMetaEvent } from "./meta-capi";

/*
 * Server-side events from server actions (Next.js only). Meta Conversions API
 * goes out after the response, and only when the visitor's consent cookie
 * says marketing = yes and the Pixel + token are configured.
 */

export interface ServerEventInput {
  event: EventName;
  eventId: string;
  /** path on the site where it happened, e.g. "/zapishi-chas" */
  path: string;
  email?: string | null;
  /** E.164-style ("+359…"): Meta matches numbers with the country code */
  phone?: string | null;
  fullName?: string | null;
  /** our customer id (same person across events) */
  externalId?: string | null;
  fbclid?: string | null;
  value?: number;
  contentName?: string;
}

export async function trackServerEvent(input: ServerEventInput): Promise<void> {
  const route = EVENT_ROUTES[input.event];
  if (!route.metaCapi || route.meta.length === 0) return;
  const env = serverEnv();
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!pixelId || !env.META_CAPI_ACCESS_TOKEN) {
    console.info(`[meta-capi] ${input.event} skipped: ${pixelId ? "no access token" : "no pixel id"}`);
    return;
  }

  const jar = await cookies();
  const consent = parseConsent(jar.get(CONSENT_COOKIE)?.value);
  if (!consent?.marketing) {
    console.info(`[meta-capi] ${input.event} skipped: no marketing consent`);
    return;
  }

  const h = await headers();
  const now = new Date();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const event = {
    eventNames: route.meta,
    eventId: input.eventId,
    eventTime: now,
    sourceUrl: new URL(input.path, env.APP_URL).toString(),
    user: {
      email: input.email,
      phone: input.phone,
      fullName: input.fullName,
      externalId: input.externalId,
      fbp: jar.get("_fbp")?.value ?? null,
      fbc: fbcValue(jar.get("_fbc")?.value, input.fbclid, now) ?? null,
      ip,
      userAgent: h.get("user-agent"),
    },
    custom: {
      ...(input.value !== undefined ? { value: input.value, currency: "EUR" } : {}),
      ...(input.contentName ? { content_name: input.contentName } : {}),
    },
  };
  const cfg = { pixelId, accessToken: env.META_CAPI_ACCESS_TOKEN, testEventCode: env.META_TEST_EVENT_CODE ?? null };
  after(() => sendMetaEvent(event, cfg).then(() => undefined));
}
