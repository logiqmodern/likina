import { describe, expect, it } from "vitest";
import { buildCsp, newNonce, usesNonceCsp } from "./security-headers";

describe("security headers", () => {
  it("nonce paths: admin, booking flow, manage page", () => {
    expect(usesNonceCsp("/admin")).toBe(true);
    expect(usesNonceCsp("/admin/kalendar")).toBe(true);
    expect(usesNonceCsp("/porachka")).toBe(true);
    expect(usesNonceCsp("/porachka/abc")).toBe(true);
    expect(usesNonceCsp("/en/checkout")).toBe(true);
    expect(usesNonceCsp("/en/order/abc")).toBe(true);
    expect(usesNonceCsp("/")).toBe(false);
    expect(usesNonceCsp("/ceni")).toBe(false);
    expect(usesNonceCsp("/administrator")).toBe(false);
  });

  it("nonce CSP: no unsafe-inline scripts, strict-dynamic, no framing", () => {
    const csp = buildCsp({ nonce: "abc=" });
    expect(csp).toContain("script-src 'self' 'nonce-abc=' 'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("static CSP: only our origin and the allow-listed trackers run scripts", () => {
    const csp = buildCsp({});
    const script = csp.split("; ").find((d) => d.startsWith("script-src "))!;
    expect(script).toContain("https://www.googletagmanager.com");
    expect(script).toContain("https://connect.facebook.net");
    expect(script).not.toContain("https: ");
    expect(script).not.toContain("*");
  });

  it("dev allows eval (React debugging) and websockets (HMR), without upgrade-insecure-requests", () => {
    const csp = buildCsp({ dev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("nonces are random", () => {
    expect(newNonce()).not.toBe(newNonce());
    expect(newNonce().length).toBeGreaterThanOrEqual(22);
  });
});
