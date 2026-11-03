import { describe, expect, it } from "vitest";
import { isTrackingParam, withTrackingParams } from "./utm";

describe("isTrackingParam", () => {
  it("accepts utm_* and the click ids", () => {
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id", "fbclid", "gclid"]) {
      expect(isTrackingParam(key)).toBe(true);
    }
  });

  it("rejects everything else", () => {
    for (const key of ["usluga", "utm_", "utm", "ref", "fbclid2", "utm_a-b"]) {
      expect(isTrackingParam(key)).toBe(false);
    }
  });
});

describe("withTrackingParams", () => {
  it("appends tracking params and keeps the existing query", () => {
    const current = new URLSearchParams("utm_source=facebook&utm_campaign=probna&fbclid=abc123&foo=bar");
    expect(withTrackingParams("/zapishi-chas?usluga=probna-procedura", current)).toBe(
      "/zapishi-chas?usluga=probna-procedura&utm_source=facebook&utm_campaign=probna&fbclid=abc123",
    );
  });

  it("returns the href unchanged when there is nothing to carry", () => {
    expect(withTrackingParams("/zapishi-chas?usluga=x", new URLSearchParams("foo=bar"))).toBe("/zapishi-chas?usluga=x");
    expect(withTrackingParams("/zapishi-chas", null)).toBe("/zapishi-chas");
  });

  it("does not override a parameter already in the href", () => {
    const current = new URLSearchParams("utm_source=google");
    expect(withTrackingParams("/zapishi-chas?utm_source=landing", current)).toBe("/zapishi-chas?utm_source=landing");
  });

  it("drops empty and oversized values", () => {
    const current = new URLSearchParams({ utm_source: "", gclid: "x".repeat(501), utm_medium: "cpc" });
    expect(withTrackingParams("/zapishi-chas", current)).toBe("/zapishi-chas?utm_medium=cpc");
  });

  it("encodes values safely and keeps the hash", () => {
    const current = new URLSearchParams({ utm_campaign: "есен 2026 & още" });
    const out = withTrackingParams("/zapishi-chas#top", current);
    expect(new URL(out, "http://x").searchParams.get("utm_campaign")).toBe("есен 2026 & още");
    expect(out.endsWith("#top")).toBe(true);
  });

  it("never touches external or protocol-relative links", () => {
    const current = new URLSearchParams("utm_source=fb");
    expect(withTrackingParams("tel:+359887374755", current)).toBe("tel:+359887374755");
    expect(withTrackingParams("https://offline45.com", current)).toBe("https://offline45.com");
    expect(withTrackingParams("//evil.example/x", current)).toBe("//evil.example/x");
  });
});
