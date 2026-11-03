import { describe, expect, it } from "vitest";
import { withdrawnCategories } from "./loader";
import {
  cookieDomainCandidates,
  cookieNames,
  expireCookieAssignments,
  isSensitivePath,
  safePageLocation,
  trackerCookiesToDelete,
} from "./privacy";

describe("safePageLocation", () => {
  it("hides the manage token and its query string", () => {
    expect(safePageLocation("https://example.bg/rezervaciya/AbC123secret?x=1#a")).toBe("https://example.bg/rezervaciya/[token]");
    expect(safePageLocation("https://example.bg/rezervaciya/AbC123secret/kalendar.ics")).toBe(
      "https://example.bg/rezervaciya/[token]/kalendar.ics",
    );
  });

  it("leaves other pages (and their campaign parameters) alone", () => {
    expect(safePageLocation("https://example.bg/oferta/x?utm_source=fb")).toBe("https://example.bg/oferta/x?utm_source=fb");
    expect(safePageLocation("https://example.bg/rezervaciya")).toBe("https://example.bg/rezervaciya");
    expect(safePageLocation("not a url")).toBe("");
  });

  it("knows which pages carry a secret", () => {
    expect(isSensitivePath("/rezervaciya/abc")).toBe(true);
    expect(isSensitivePath("/zapishi-chas/potvardeno")).toBe(false);
  });
});

describe("tracker cookies to delete", () => {
  const header = "_ga=GA1.1.1; _ga_ABC123=GS1; _gid=x; _gcl_au=1.1; _gcl_aw=GCL; _fbp=fb.1; _fbc=fb.1.x; lio_consent=1.0.0.1.abc; _gat=1; other=1";

  it("lists cookie names", () => {
    expect(cookieNames(header)).toContain("lio_consent");
    expect(cookieNames("")).toEqual([]);
    expect(cookieNames(null)).toEqual([]);
  });

  it("only those of the withdrawn categories", () => {
    expect(trackerCookiesToDelete(header, { analytics: true, marketing: false })).toEqual(["_ga", "_ga_ABC123", "_gid"]);
    expect(trackerCookiesToDelete(header, { analytics: false, marketing: true })).toEqual(["_gcl_au", "_gcl_aw", "_fbp", "_fbc"]);
    expect(trackerCookiesToDelete(header, { analytics: false, marketing: false })).toEqual([]);
  });

  it("never our own cookies", () => {
    const all = trackerCookiesToDelete(header, { analytics: true, marketing: true });
    expect(all).not.toContain("lio_consent");
    expect(all).not.toContain("other");
  });
});

describe("cookie domains", () => {
  it("host and every parent with two labels or more", () => {
    expect(cookieDomainCandidates("www.lejishiotslabvash.com")).toEqual(["www.lejishiotslabvash.com", "lejishiotslabvash.com"]);
    expect(cookieDomainCandidates("lejishiotslabvash.com")).toEqual(["lejishiotslabvash.com"]);
    expect(cookieDomainCandidates("a.b.example.co.uk")).toEqual(["a.b.example.co.uk", "b.example.co.uk", "example.co.uk", "co.uk"]);
    expect(cookieDomainCandidates("WWW.Example.BG.")).toEqual(["www.example.bg", "example.bg"]);
  });

  it("localhost and IP addresses have host-only cookies", () => {
    expect(cookieDomainCandidates("localhost")).toEqual([]);
    expect(cookieDomainCandidates("127.0.0.1")).toEqual([]);
    expect(cookieDomainCandidates("[::1]")).toEqual([]);
  });

  it("expires the cookie host-only and on each domain", () => {
    expect(expireCookieAssignments("_ga", "www.example.bg")).toEqual([
      "_ga=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/",
      "_ga=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; Domain=.www.example.bg",
      "_ga=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; Domain=.example.bg",
    ]);
    expect(expireCookieAssignments("_fbp", "127.0.0.1")).toEqual(["_fbp=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/"]);
  });
});

describe("withdrawnCategories", () => {
  it("yes → no only", () => {
    expect(withdrawnCategories({ analytics: true, marketing: true }, { analytics: false, marketing: true })).toEqual({
      analytics: true,
      marketing: false,
    });
    expect(withdrawnCategories(null, { analytics: false, marketing: false })).toEqual({ analytics: false, marketing: false });
    expect(withdrawnCategories({ analytics: false, marketing: false }, { analytics: true, marketing: true })).toEqual({
      analytics: false,
      marketing: false,
    });
  });
});
