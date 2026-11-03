import { createHash } from "node:crypto";
import type { MetaEventName } from "@/lib/analytics/events";

/*
 * Meta Conversions API (§9.2): the server-side twin of a Pixel event, sent
 * only with marketing consent. Same `event_id` as the browser event, so Meta
 * counts it once. Personal data is hashed (SHA-256) as Meta requires.
 * https://developers.facebook.com/docs/marketing-api/conversions-api
 */

export const META_GRAPH_VERSION = "v24.0";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Meta normalisation: e-mail trimmed + lower case; phone digits only with country code. */
export function hashEmail(email: string | null | undefined): string | undefined {
  const e = email?.trim().toLowerCase();
  return e ? sha256Hex(e) : undefined;
}

export function hashPhone(phone: string | null | undefined): string | undefined {
  const digits = phone?.replace(/\D/g, "");
  return digits ? sha256Hex(digits) : undefined;
}

/** First and last word of a full name, trimmed, lower case, hashed (Meta `fn` / `ln`). */
export function hashName(fullName: string | null | undefined): { fn?: string; ln?: string } {
  const words = (fullName ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return {};
  return words.length === 1 ? { fn: sha256Hex(words[0]!) } : { fn: sha256Hex(words[0]!), ln: sha256Hex(words.at(-1)!) };
}

/** `_fbc` value from the cookie, or built from a fbclid (fb.1.<ms>.<fbclid>). */
export function fbcValue(cookie: string | null | undefined, fbclid: string | null | undefined, now: Date): string | undefined {
  if (cookie) return cookie;
  return fbclid ? `fb.1.${now.getTime()}.${fbclid}` : undefined;
}

export interface MetaServerEvent {
  /** one entry per Meta event; all share the same event_id (dedup is per name + id) */
  eventNames: readonly MetaEventName[];
  eventId: string;
  eventTime: Date;
  sourceUrl: string;
  user: {
    email?: string | null;
    phone?: string | null;
    fbp?: string | null;
    fbc?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    fullName?: string | null;
    /** our customer id — the same person across events (hashed) */
    externalId?: string | null;
  };
  custom?: { value?: number; currency?: string; content_name?: string };
}

export function metaPayload(e: MetaServerEvent, testEventCode?: string | null) {
  const user_data: Record<string, unknown> = {};
  const em = hashEmail(e.user.email);
  const ph = hashPhone(e.user.phone);
  if (em) user_data.em = [em];
  if (ph) user_data.ph = [ph];
  const { fn, ln } = hashName(e.user.fullName);
  if (fn) user_data.fn = [fn];
  if (ln) user_data.ln = [ln];
  if (e.user.externalId) user_data.external_id = [sha256Hex(e.user.externalId)];
  // A Bulgarian number says the country; anything else is left out rather than guessed.
  if (e.user.phone?.replace(/\D/g, "").startsWith("359")) user_data.country = [sha256Hex("bg")];
  if (e.user.fbp) user_data.fbp = e.user.fbp;
  if (e.user.fbc) user_data.fbc = e.user.fbc;
  if (e.user.ip) user_data.client_ip_address = e.user.ip;
  if (e.user.userAgent) user_data.client_user_agent = e.user.userAgent;
  return {
    data: e.eventNames.map((name) => ({
      event_name: name,
      event_time: Math.floor(e.eventTime.getTime() / 1000),
      event_id: e.eventId,
      event_source_url: e.sourceUrl,
      action_source: "website",
      user_data,
      ...(e.custom ? { custom_data: e.custom } : {}),
    })),
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  };
}

/** Sends one event; never throws (analytics must not break a booking). Returns whether Meta accepted it. */
export async function sendMetaEvent(
  e: MetaServerEvent,
  cfg: { pixelId: string; accessToken: string; testEventCode?: string | null },
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const res = await fetchImpl(`https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(cfg.pixelId)}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.accessToken}` },
      body: JSON.stringify(metaPayload(e, cfg.testEventCode)),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      // Meta's error body names the cause (bad token, wrong dataset, …); no personal data in it.
      const detail = await res.text().catch(() => "");
      console.warn(`[meta-capi] ${e.eventNames.join("+")} rejected: ${res.status} ${detail.slice(0, 300)}`);
      return false;
    }
    const body = (await res.json().catch(() => null)) as { events_received?: number } | null;
    console.info(`[meta-capi] ${e.eventNames.join("+")} sent: events_received=${body?.events_received ?? "?"}`);
    return true;
  } catch (error) {
    console.warn(`[meta-capi] ${e.eventNames.join("+")} failed: ${(error as Error).message}`);
    return false;
  }
}
