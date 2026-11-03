import { describe, expect, it } from "vitest";
import { CONSENT_VERSION, googleConsentState, parseConsent, readCookie, serializeConsent } from "./consent";

describe("consent cookie", () => {
  const at = new Date("2026-10-12T10:00:00Z");
  it("round-trips", () => {
    const v = serializeConsent({ analytics: true, marketing: false, at, id: "abcDEF123_-x" });
    expect(v).toBe(`${CONSENT_VERSION}.1.0.${at.getTime() / 1000}.abcDEF123_-x`);
    expect(parseConsent(v)).toEqual({ version: CONSENT_VERSION, analytics: true, marketing: false, at, id: "abcDEF123_-x" });
    expect(parseConsent(encodeURIComponent(v))?.analytics).toBe(true);
  });
  it("an old version or garbage means 'ask again'", () => {
    expect(parseConsent(`0.1.1.${at.getTime() / 1000}.abcDEF123`)).toBeNull();
    expect(parseConsent("1.2.0.1.abcDEF123")).toBeNull();
    expect(parseConsent("1.1.0.x.abcDEF123")).toBeNull();
    expect(parseConsent("1.1.0.1.<script>")).toBeNull();
    expect(parseConsent(null)).toBeNull();
  });
  it("maps to Consent Mode v2", () => {
    expect(googleConsentState(null)).toEqual({
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    expect(googleConsentState({ analytics: true, marketing: false })).toMatchObject({ analytics_storage: "granted", ad_storage: "denied" });
    expect(googleConsentState({ analytics: false, marketing: true })).toMatchObject({ ad_user_data: "granted", ad_personalization: "granted" });
  });
  it("reads a cookie from a header", () => {
    expect(readCookie("a=1; lio_consent=1.1.1.5.abcdefgh; b=2", "lio_consent")).toBe("1.1.1.5.abcdefgh");
    expect(readCookie("a=1", "lio_consent")).toBeNull();
  });
});
