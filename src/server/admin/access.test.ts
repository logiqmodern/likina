import { describe, expect, it } from "vitest";
import { ADMIN_SECTIONS, activeSection, sectionsForRole } from "@/lib/admin-nav";
import { decideAccess, mfaRequiredFor, pendingMfaStep } from "./access";
import type { AdminRole, AdminSessionContext } from "./session";

const ctx = (role: AdminRole, opts: { mfaVerified: boolean; totpEnabled: boolean }): AdminSessionContext => ({
  sessionId: "s",
  mfaVerified: opts.mfaVerified,
  expiresAt: new Date("2030-01-01"),
  user: { id: "u", email: "a@b.bg", name: "A", role, totpEnabled: opts.totpEnabled },
});

describe("decideAccess", () => {
  it("sends anonymous visitors to the login page", () => {
    expect(decideAccess(null)).toEqual({ kind: "redirect", to: "/admin/vhod" });
    expect(decideAccess(null, { allowMfaPending: true })).toEqual({ kind: "redirect", to: "/admin/vhod" });
  });

  it("blocks an MFA-pending session from the panel, allows it on the 2FA pages", () => {
    const pending = ctx("owner", { mfaVerified: false, totpEnabled: true });
    expect(decideAccess(pending)).toEqual({ kind: "redirect", to: "/admin/2fa" });
    expect(decideAccess(pending, { allowMfaPending: true })).toMatchObject({ kind: "ok", mfaPending: true });
  });

  it("sends owner/developer without 2FA to enrolment even if the session is marked verified", () => {
    expect(decideAccess(ctx("developer", { mfaVerified: true, totpEnabled: false }))).toEqual({
      kind: "redirect",
      to: "/admin/2fa/nastroyka",
    });
    expect(decideAccess(ctx("owner", { mfaVerified: false, totpEnabled: false }))).toEqual({
      kind: "redirect",
      to: "/admin/2fa/nastroyka",
    });
  });

  it("enforces roles", () => {
    const owner = ctx("owner", { mfaVerified: true, totpEnabled: true });
    expect(decideAccess(owner, { roles: ["developer"] })).toEqual({ kind: "forbidden" });
    expect(decideAccess(owner, { roles: ["owner", "developer"] })).toMatchObject({ kind: "ok" });
  });

  it("knows who needs a second factor", () => {
    expect(mfaRequiredFor({ role: "owner", totpEnabled: false })).toBe(true);
    expect(mfaRequiredFor({ role: "developer", totpEnabled: false })).toBe(true);
    expect(pendingMfaStep(ctx("owner", { mfaVerified: true, totpEnabled: true }))).toBeNull();
  });
});

describe("admin navigation", () => {
  it("owner and developer see the same short list of sections", () => {
    expect(sectionsForRole("owner").map((s) => s.label)).toEqual(["Табло", "Творби", "Поръчки", "Запитвания", "Настройки"]);
    expect(sectionsForRole("developer")).toHaveLength(ADMIN_SECTIONS.length);
  });

  it("matches the active section by path", () => {
    expect(activeSection("/admin")?.key).toBe("tablo");
    expect(activeSection("/admin/tvorbi/123")?.key).toBe("tvorbi");
    expect(activeSection("/admin/tvorbix")).toBeNull();
  });
});
