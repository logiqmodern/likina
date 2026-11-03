import { describe, expect, it, vi } from "vitest";
import { EVENT_ROUTES } from "@/lib/analytics/events";
import { fbcValue, hashEmail, hashName, hashPhone, metaPayload, sendMetaEvent, sha256Hex } from "./meta-capi";

describe("Meta Conversions API", () => {
  const now = new Date("2026-10-12T10:00:00Z");
  it("normalises and hashes e-mail and phone", () => {
    expect(hashEmail("  Maria@Example.COM ")).toBe(sha256Hex("maria@example.com"));
    expect(hashPhone("+359 887 000 111")).toBe(sha256Hex("359887000111"));
    expect(hashEmail("")).toBeUndefined();
    expect(hashPhone(null)).toBeUndefined();
  });
  it("builds fbc from the cookie or the click id", () => {
    expect(fbcValue("fb.1.1.abc", "x", now)).toBe("fb.1.1.abc");
    expect(fbcValue(null, "IwAR123", now)).toBe(`fb.1.${now.getTime()}.IwAR123`);
    expect(fbcValue(null, null, now)).toBeUndefined();
  });
  it("payload: event id for dedup, hashed user data only, test code when set", () => {
    const p = metaPayload(
      {
        eventNames: ["Lead", "Schedule"],
        eventId: "booking_confirmed:b1",
        eventTime: now,
        sourceUrl: "https://example.com/zapishi-chas",
        user: { email: "a@b.bg", phone: "+359888", ip: "1.2.3.4", userAgent: "UA" },
        custom: { value: 59, currency: "EUR" },
      },
      "TEST123",
    );
    expect(p.test_event_code).toBe("TEST123");
    expect(p.data.map((x) => x.event_name)).toEqual(["Lead", "Schedule"]);
    expect(new Set(p.data.map((x) => x.event_id))).toEqual(new Set(["booking_confirmed:b1"]));
    const d = p.data[1]!;
    expect(d).toMatchObject({ event_name: "Schedule", event_id: "booking_confirmed:b1", action_source: "website", event_time: now.getTime() / 1000 });
    expect(JSON.stringify(d)).not.toContain("a@b.bg");
    expect(d.user_data).toMatchObject({ em: [sha256Hex("a@b.bg")], ph: [sha256Hex("359888")], client_ip_address: "1.2.3.4" });
  });
  it("a confirmed booking goes to Meta as Lead + Schedule, an inquiry as Lead, a started booking as InitiateCheckout", () => {
    expect(EVENT_ROUTES.booking_confirmed.meta).toEqual(["Lead", "Schedule"]);
    expect(EVENT_ROUTES.inquiry_submitted.meta).toEqual(["Lead"]);
    expect(EVENT_ROUTES.booking_start.meta).toEqual(["InitiateCheckout"]);
    expect(EVENT_ROUTES.booking_start.metaCapi).toBe(false);
  });
  it("names: first and last name, trimmed and lower case (Cyrillic kept)", () => {
    expect(hashName("  Мира   Найденова ")).toEqual({ fn: sha256Hex("мира"), ln: sha256Hex("найденова") });
    expect(hashName("Мария Петрова-Иванова Георгиева")).toEqual({ fn: sha256Hex("мария"), ln: sha256Hex("георгиева") });
    expect(hashName("Мира")).toEqual({ fn: sha256Hex("мира") });
    expect(hashName(" ")).toEqual({});
  });

  it("more matching keys: name, a stable customer id, country from a Bulgarian number", () => {
    const p = metaPayload({
      eventNames: ["Lead"],
      eventId: "x",
      eventTime: now,
      sourceUrl: "https://example.com/",
      user: { phone: "+359888123456", fullName: "Мира Найденова", externalId: "cust-1" },
    });
    expect(p.data[0]!.user_data).toMatchObject({
      fn: [sha256Hex("мира")],
      ln: [sha256Hex("найденова")],
      external_id: [sha256Hex("cust-1")],
      country: [sha256Hex("bg")],
    });
    const foreign = metaPayload({ eventNames: ["Lead"], eventId: "x", eventTime: now, sourceUrl: "https://e.com/", user: { phone: "+447700900123" } });
    expect(foreign.data[0]!.user_data).not.toHaveProperty("country");
  });

  it("never throws", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("down")) as unknown as typeof fetch;
    const ok = await sendMetaEvent(
      { eventNames: ["Lead"], eventId: "x", eventTime: now, sourceUrl: "https://e.com", user: {} },
      { pixelId: "1", accessToken: "t" },
      failing,
    );
    expect(ok).toBe(false);
  });
});
