import { describe, expect, it } from "vitest";
import {
  attributionFromUrl,
  landingPath,
  newerAttribution,
  parseAttribution,
  resolveAttribution,
  serializeAttribution,
} from "./attribution";

const T = 1_760_000_000_000;

describe("attributionFromUrl", () => {
  it("keeps utm_* and the click ids, with the landing path", () => {
    const a = attributionFromUrl("?utm_source=facebook&utm_medium=cpc&utm_campaign=Есен&fbclid=abc123&usluga=proba", "/oferta/esen", T);
    expect(a).toEqual({
      params: { utm_source: "facebook", utm_medium: "cpc", utm_campaign: "Есен", fbclid: "abc123" },
      landing: "/oferta/esen",
      at: T,
    });
  });

  it("is null without campaign parameters", () => {
    expect(attributionFromUrl("?usluga=proba&stap=2", "/zapishi-chas", T)).toBeNull();
    expect(attributionFromUrl("", "/", T)).toBeNull();
    expect(attributionFromUrl("?utm_source=", "/", T)).toBeNull();
  });

  it("drops oversized values (not real ad parameters)", () => {
    expect(attributionFromUrl(`?utm_source=${"x".repeat(201)}`, "/", T)).toBeNull();
    expect(attributionFromUrl(`?gclid=${"x".repeat(500)}`, "/", T)?.params.gclid).toHaveLength(500);
    expect(attributionFromUrl(`?gclid=${"x".repeat(501)}&utm_source=g`, "/", T)?.params).toEqual({ utm_source: "g" });
  });

  it("accepts URLSearchParams", () => {
    expect(attributionFromUrl(new URLSearchParams({ gclid: "g1" }), "/ceni", T)?.params).toEqual({ gclid: "g1" });
  });
});

describe("landingPath", () => {
  it("is the path only", () => {
    expect(landingPath("/oferta/x?utm_source=a#top")).toBe("/oferta/x");
    expect(landingPath("")).toBe("/");
    expect(landingPath("ceni")).toBe("/ceni");
    expect(landingPath(`/${"a".repeat(300)}`)).toHaveLength(200);
  });
});

describe("serialize / parse", () => {
  it("round-trips through a cookie-safe string", () => {
    const a = attributionFromUrl("?utm_source=google&utm_campaign=a b;c&gclid=Cj0=", "/", T)!;
    const s = serializeAttribution(a);
    expect(s).not.toMatch(/[;,\s]/);
    expect(parseAttribution(s)).toEqual(a);
  });

  it("rejects garbage and records without parameters", () => {
    expect(parseAttribution(null)).toBeNull();
    expect(parseAttribution("%E0%A4%A")).toBeNull();
    expect(parseAttribution("not json")).toBeNull();
    expect(parseAttribution(encodeURIComponent(JSON.stringify({ p: {}, l: "/", t: T })))).toBeNull();
    expect(parseAttribution(encodeURIComponent(JSON.stringify({ p: { utm_source: "a" }, l: "/", t: "x" })))).toBeNull();
    expect(parseAttribution(encodeURIComponent(JSON.stringify([1, 2])))).toBeNull();
  });

  it("drops unknown and invalid fields from a stored record", () => {
    const raw = encodeURIComponent(JSON.stringify({ p: { utm_source: "a", evil: "x", utm_term: 5 }, l: "/ceni?x=1", t: T }));
    expect(parseAttribution(raw)).toEqual({ params: { utm_source: "a" }, landing: "/ceni", at: T });
  });
});

describe("newerAttribution", () => {
  const old = { params: { utm_source: "old" }, landing: "/", at: T };
  const fresh = { params: { utm_source: "new" }, landing: "/", at: T + 1 };
  it("latest campaign visit wins; nothing never replaces something", () => {
    expect(newerAttribution(old, fresh)).toBe(fresh);
    expect(newerAttribution(fresh, old)).toBe(fresh);
    expect(newerAttribution(old, null)).toBe(old);
    expect(newerAttribution(null, fresh)).toBe(fresh);
    expect(newerAttribution(null, null)).toBeNull();
  });
});

describe("resolveAttribution", () => {
  const url = { params: { utm_source: "url" }, landing: "/zapishi-chas", at: T + 2 };
  const session = { params: { utm_source: "session", fbclid: "f" }, landing: "/oferta/a", at: T + 1 };
  const cookie = { params: { utm_source: "cookie", gclid: "g" }, landing: "/ceni", at: T };

  it("URL parameters > this session > the 30-day cookie, never mixed", () => {
    expect(resolveAttribution({ url, session, cookie, sessionLanding: "/oferta/a" })).toMatchObject({
      utmSource: "url",
      fbclid: null,
      gclid: null,
      landingPage: "/oferta/a",
    });
    expect(resolveAttribution({ url: null, session, cookie, sessionLanding: "/oferta/a" })).toMatchObject({
      utmSource: "session",
      fbclid: "f",
      gclid: null,
      landingPage: "/oferta/a",
    });
    expect(resolveAttribution({ url: null, session: null, cookie, sessionLanding: "/" })).toMatchObject({
      utmSource: "cookie",
      gclid: "g",
      landingPage: "/ceni",
    });
  });

  it("without a campaign: only the first page of this session", () => {
    expect(resolveAttribution({ url: null, session: null, cookie: null, sessionLanding: "/kak-raboti" })).toEqual({
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      utmTerm: null,
      fbclid: null,
      gclid: null,
      landingPage: "/kak-raboti",
    });
    expect(resolveAttribution({ url: null, session: null, cookie: null, sessionLanding: null }).landingPage).toBeNull();
  });

  it("URL record without a stored session landing uses its own path", () => {
    expect(resolveAttribution({ url, session: null, cookie: null, sessionLanding: null }).landingPage).toBe("/zapishi-chas");
  });
});
