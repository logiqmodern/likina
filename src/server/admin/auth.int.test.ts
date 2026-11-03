import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { adminSessions, adminUsers } from "@/db/schema";
import { createTestDb, hasDatabase } from "@/test/db";
import { sha256 } from "../crypto";
import { checkAdminAccess } from "./access";
import {
  bootstrapFirstAdmin,
  confirmTotpEnrollment,
  getOrCreatePendingTotp,
  isBootstrapOpen,
  login,
  verifySecondFactor,
} from "./login";
import { hashPassword } from "./password";
import { type AdminRole, createSession, destroySession, readSession, SESSION_TTL_MS } from "./session";
import { deriveTotpKey, encryptSecret, generateTotpCode, generateTotpSecret } from "./totp";

// 08:00:00Z is aligned to both rate-limit windows (10 and 15 min).
const NOW = new Date("2026-10-12T08:00:00Z");
const at = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);
const KEY = deriveTotpKey("integration-test-session-secret-0123456789");
const PASSWORD = "много-дълга-парола-42";
const SETUP_TOKEN = "setup-token-for-tests-0123456789";

describe.skipIf(!hasDatabase)("admin auth (Postgres)", () => {
  const { db, pool } = hasDatabase ? createTestDb() : ({} as ReturnType<typeof createTestDb>);
  let passwordHash: string;

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE admin_sessions, admin_users, rate_limits RESTART IDENTITY CASCADE`);
    passwordHash ??= await hashPassword(PASSWORD);
  });

  afterAll(async () => {
    await pool?.end();
  });

  async function createUser(
    role: AdminRole,
    opts: { email?: string; totpSecret?: string; isActive?: boolean } = {},
  ): Promise<string> {
    const [u] = await db
      .insert(adminUsers)
      .values({
        email: opts.email ?? `${role}@example.com`,
        name: `Test ${role}`,
        passwordHash,
        role,
        totpSecretEnc: opts.totpSecret ? encryptSecret(opts.totpSecret, KEY) : null,
        totpEnabledAt: opts.totpSecret ? NOW : null,
        isActive: opts.isActive ?? true,
      })
      .returning({ id: adminUsers.id });
    return u!.id;
  }

  const attempt = (email: string, password: string, now: Date, ip = "203.0.113.7", currentToken?: string) =>
    login(db, { email, password, ip, userAgent: "vitest", currentToken, now });

  async function userRow(id: string) {
    const [u] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
    return u!;
  }

  describe("login", () => {
    it("signs an owner in: stores only the token hash, resets counters, sends to 2FA enrolment", async () => {
      const id = await createUser("owner");
      await db.update(adminUsers).set({ failedAttempts: 3 }).where(eq(adminUsers.id, id));

      const r = await attempt(" Owner@Example.com ", PASSWORD, NOW);
      expect(r).toMatchObject({ ok: true, next: "/admin/2fa/nastroyka" });
      if (!r.ok) throw new Error("unreachable");
      expect(r.session.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(r.session.expiresAt.getTime()).toBe(NOW.getTime() + SESSION_TTL_MS);

      const [s] = await db.select().from(adminSessions);
      expect(s).toMatchObject({ userId: id, tokenHash: sha256(r.session.token) });
      expect(s!.ipHash).toBe(sha256("203.0.113.7"));
      expect(JSON.stringify(s)).not.toContain(r.session.token);

      const u = await userRow(id);
      expect(u).toMatchObject({ failedAttempts: 0, lockedUntil: null });
      expect(u.lastLoginAt?.toISOString()).toBe(NOW.toISOString());

      // 2FA is mandatory for every role: the panel stays closed until enrolment.
      expect(await checkAdminAccess(db, r.session.token, {}, NOW)).toEqual({ kind: "redirect", to: "/admin/2fa/nastroyka" });
    });

    it("rotates: a new session replaces the one the browser held", async () => {
      await createUser("owner");
      const first = await attempt("owner@example.com", PASSWORD, NOW);
      if (!first.ok) throw new Error("login failed");
      const second = await attempt("owner@example.com", PASSWORD, at(5), undefined, first.session.token);
      if (!second.ok) throw new Error("login failed");
      expect(second.session.token).not.toBe(first.session.token);
      expect(await readSession(db, first.session.token, at(6))).toBeNull();
      expect(await readSession(db, second.session.token, at(6))).not.toBeNull();
    });

    it("rejects a wrong password and an unknown e-mail with the same error", async () => {
      const id = await createUser("owner");
      expect(await attempt("owner@example.com", "wrong-password-123", NOW)).toEqual({ ok: false, error: "invalid" });
      expect(await attempt("nobody@example.com", PASSWORD, at(1))).toEqual({ ok: false, error: "invalid" });
      expect((await userRow(id)).failedAttempts).toBe(1);
      expect(await db.select().from(adminSessions)).toHaveLength(0);
    });

    it("rejects inactive users like unknown ones and ends their sessions", async () => {
      const id = await createUser("owner", { isActive: false });
      expect(await attempt("owner@example.com", PASSWORD, NOW)).toEqual({ ok: false, error: "invalid" });
      const s = await createSession(db, { userId: id, mfaVerified: true, now: NOW });
      expect(await readSession(db, s.token, at(1))).toBeNull();
    });

    it("locks the account for 15 minutes after 5 consecutive failures", async () => {
      const id = await createUser("owner");
      // Failures at the end of one 15-min e-mail window, so the lock is tested apart from the rate limit.
      const base = 14 * 60 + 50;
      for (let i = 0; i < 5; i++) {
        expect(await attempt("owner@example.com", `wrong-password-${i}`, at(base + i))).toEqual({
          ok: false,
          error: "invalid",
        });
      }
      const u = await userRow(id);
      expect(u.failedAttempts).toBe(0);
      expect(u.lockedUntil?.toISOString()).toBe(at(base + 4 + 15 * 60).toISOString());

      // New rate-limit window, correct password — still locked.
      expect(await attempt("owner@example.com", PASSWORD, at(15 * 60 + 30))).toEqual({ ok: false, error: "locked" });
      // After the lock: success, counters reset.
      const ok = await attempt("owner@example.com", PASSWORD, at(30 * 60 + 30));
      expect(ok.ok).toBe(true);
      expect(await userRow(id)).toMatchObject({ failedAttempts: 0, lockedUntil: null });
    });

    it("a success between failures resets the consecutive count", async () => {
      const id = await createUser("owner");
      for (let i = 0; i < 3; i++) await attempt("owner@example.com", "wrong-password-x", at(i), `198.51.100.${i}`);
      expect((await userRow(id)).failedAttempts).toBe(3);
      expect((await attempt("owner@example.com", PASSWORD, at(4))).ok).toBe(true);
      expect((await userRow(id)).failedAttempts).toBe(0);
    });

    it("rate-limits by e-mail (5 / 15 min), whether or not the account exists", async () => {
      for (let i = 0; i < 5; i++) await attempt("ghost@example.com", "whatever-123", at(i), `198.51.100.${i}`);
      expect(await attempt("ghost@example.com", "whatever-123", at(10), "198.51.100.99")).toEqual({
        ok: false,
        error: "rate_limited",
      });
    });

    it("rate-limits by IP (10 / 10 min) even with correct credentials", async () => {
      await createUser("owner");
      for (let i = 0; i < 10; i++) await attempt(`someone${i}@example.com`, "whatever-123", at(i));
      expect(await attempt("owner@example.com", PASSWORD, at(20))).toEqual({ ok: false, error: "rate_limited" });
      // Another IP is unaffected.
      expect((await attempt("owner@example.com", PASSWORD, at(21), "192.0.2.1")).ok).toBe(true);
    });
  });

  describe("sessions", () => {
    it("expire absolutely after 14 days", async () => {
      const id = await createUser("owner");
      const s = await createSession(db, { userId: id, mfaVerified: true, now: NOW });
      expect(await readSession(db, s.token, new Date(NOW.getTime() + SESSION_TTL_MS - 1000))).not.toBeNull();
      expect(await readSession(db, s.token, new Date(NOW.getTime() + SESSION_TTL_MS))).toBeNull();
      expect(
        await checkAdminAccess(db, s.token, {}, new Date(NOW.getTime() + SESSION_TTL_MS + 1)),
      ).toEqual({ kind: "redirect", to: "/admin/vhod" });
    });

    it("updates last_seen_at at most every 5 minutes", async () => {
      const id = await createUser("owner");
      const s = await createSession(db, { userId: id, mfaVerified: true, now: NOW });
      const lastSeen = async () => (await db.select().from(adminSessions))[0]!.lastSeenAt.toISOString();
      await readSession(db, s.token, at(60));
      expect(await lastSeen()).toBe(NOW.toISOString());
      await readSession(db, s.token, at(301));
      expect(await lastSeen()).toBe(at(301).toISOString());
    });

    it("ignores malformed and unknown tokens", async () => {
      expect(await readSession(db, "", NOW)).toBeNull();
      expect(await readSession(db, "' OR 1=1 --", NOW)).toBeNull();
      expect(await readSession(db, "A".repeat(43), NOW)).toBeNull();
    });

    it("logout deletes the session", async () => {
      const id = await createUser("owner");
      const s = await createSession(db, { userId: id, mfaVerified: true, now: NOW });
      await destroySession(db, s.token);
      expect(await readSession(db, s.token, at(1))).toBeNull();
      expect(await db.select().from(adminSessions)).toHaveLength(0);
    });
  });

  describe("second factor", () => {
    it("an MFA-pending session cannot pass requireAdmin; the right code upgrades it", async () => {
      const secret = generateTotpSecret();
      const id = await createUser("owner", { totpSecret: secret });

      const r = await attempt("owner@example.com", PASSWORD, NOW);
      expect(r).toMatchObject({ ok: true, next: "/admin/2fa" });
      if (!r.ok) throw new Error("unreachable");
      const pendingToken = r.session.token;

      expect(await checkAdminAccess(db, pendingToken, {}, at(1))).toEqual({ kind: "redirect", to: "/admin/2fa" });
      expect(await checkAdminAccess(db, pendingToken, { roles: ["owner"] }, at(1))).toEqual({
        kind: "redirect",
        to: "/admin/2fa",
      });
      const decision = await checkAdminAccess(db, pendingToken, { allowMfaPending: true }, at(1));
      expect(decision).toMatchObject({ kind: "ok", mfaPending: true });
      if (decision.kind !== "ok") throw new Error("unreachable");

      const ctx = decision.session;
      const verify = (code: string, now: Date) =>
        verifySecondFactor(db, { ctx, code, key: KEY, ip: "203.0.113.7", currentToken: pendingToken, now });

      expect(await verify("000000", at(2))).toEqual({ ok: false, error: "invalid" });
      const ok = await verify(generateTotpCode(secret, at(3)), at(3));
      expect(ok.ok).toBe(true);
      if (!ok.ok) throw new Error("unreachable");

      // The same code cannot be used again (replay), even inside its validity window.
      const second = await attempt("owner@example.com", PASSWORD, at(4));
      if (!second.ok) throw new Error("login failed");
      const d2 = await checkAdminAccess(db, second.session.token, { allowMfaPending: true }, at(4));
      if (d2.kind !== "ok") throw new Error("unreachable");
      const replay = await verifySecondFactor(db, {
        ctx: d2.session,
        code: generateTotpCode(secret, at(3)),
        key: KEY,
        ip: "203.0.113.7",
        currentToken: second.session.token,
        now: at(5),
      });
      expect(replay).toEqual({ ok: false, error: "invalid" });

      // Rotated: the pre-2FA token is dead, the new one is fully verified.
      expect(await readSession(db, pendingToken, at(4))).toBeNull();
      expect(await checkAdminAccess(db, ok.session.token, {}, at(4))).toMatchObject({ kind: "ok", user: { id } });
    });

    it("rate-limits code attempts per user (5 / 10 min)", async () => {
      const secret = generateTotpSecret();
      await createUser("developer", { totpSecret: secret });
      const r = await attempt("developer@example.com", PASSWORD, NOW);
      if (!r.ok) throw new Error("login failed");
      const decision = await checkAdminAccess(db, r.session.token, { allowMfaPending: true }, NOW);
      if (decision.kind !== "ok") throw new Error("unreachable");
      for (let i = 0; i < 5; i++) {
        await verifySecondFactor(db, { ctx: decision.session, code: "000000", key: KEY, ip: "x", now: at(i + 1) });
      }
      const blocked = await verifySecondFactor(db, {
        ctx: decision.session,
        code: generateTotpCode(secret, at(10)),
        key: KEY,
        ip: "x",
        now: at(10),
      });
      expect(blocked).toEqual({ ok: false, error: "rate_limited" });
    });

    it("enrolment: pending secret is stable and encrypted; a valid code enables 2FA", async () => {
      const id = await createUser("developer");
      const r = await attempt("developer@example.com", PASSWORD, NOW);
      expect(r).toMatchObject({ ok: true, next: "/admin/2fa/nastroyka" });
      if (!r.ok) throw new Error("unreachable");
      expect(await checkAdminAccess(db, r.session.token, {}, at(1))).toEqual({
        kind: "redirect",
        to: "/admin/2fa/nastroyka",
      });

      const user = { id, email: "developer@example.com" };
      const first = await getOrCreatePendingTotp(db, user, KEY);
      const again = await getOrCreatePendingTotp(db, user, KEY);
      expect(first).not.toBeNull();
      expect(again?.secret).toBe(first!.secret);
      const stored = await userRow(id);
      expect(stored.totpSecretEnc).not.toContain(first!.secret);
      expect(stored.totpEnabledAt).toBeNull();

      const decision = await checkAdminAccess(db, r.session.token, { allowMfaPending: true }, at(2));
      if (decision.kind !== "ok") throw new Error("unreachable");
      const input = { ctx: decision.session, key: KEY, ip: "x", currentToken: r.session.token };
      expect(await confirmTotpEnrollment(db, { ...input, code: "000000", now: at(3) })).toEqual({
        ok: false,
        error: "invalid",
      });
      const ok = await confirmTotpEnrollment(db, { ...input, code: generateTotpCode(first!.secret, at(4)), now: at(4) });
      expect(ok.ok).toBe(true);
      if (!ok.ok) throw new Error("unreachable");

      expect((await userRow(id)).totpEnabledAt?.toISOString()).toBe(at(4).toISOString());
      expect(await checkAdminAccess(db, ok.session.token, {}, at(5))).toMatchObject({ kind: "ok" });
      expect(await readSession(db, r.session.token, at(5))).toBeNull();
      // Once enabled, the setup page has nothing to show (no re-enrolment with a password alone).
      expect(await getOrCreatePendingTotp(db, user, KEY)).toBeNull();
      expect(
        await confirmTotpEnrollment(db, { ...input, code: generateTotpCode(first!.secret, at(6)), now: at(6) }),
      ).toEqual({ ok: false, error: "already_enrolled" });
    });
  });

  describe("roles", () => {
    it("an owner is refused developer-only pages", async () => {
      const secret = generateTotpSecret();
      const id = await createUser("owner", { totpSecret: secret });
      const s = await createSession(db, { userId: id, mfaVerified: true, now: NOW });
      expect(await checkAdminAccess(db, s.token, { roles: ["developer"] }, at(1))).toEqual({ kind: "forbidden" });
    });
  });

  describe("first-user bootstrap", () => {
    const input = (over: Partial<Parameters<typeof bootstrapFirstAdmin>[1]> = {}) => ({
      setupToken: SETUP_TOKEN,
      expectedToken: SETUP_TOKEN,
      name: "Тони",
      email: "  Dev@Example.com ",
      password: PASSWORD,
      ...over,
    });

    it("works only with no users and a matching configured token", async () => {
      expect(await isBootstrapOpen(db, undefined)).toBe(false);
      expect(await isBootstrapOpen(db, SETUP_TOKEN)).toBe(true);

      expect(await bootstrapFirstAdmin(db, input({ expectedToken: undefined }))).toEqual({ ok: false, error: "closed" });
      expect(await bootstrapFirstAdmin(db, input({ setupToken: "wrong" }))).toEqual({ ok: false, error: "invalid_token" });
      expect(await bootstrapFirstAdmin(db, input({ password: "short" }))).toMatchObject({
        ok: false,
        error: "validation",
        fieldErrors: { password: expect.stringContaining("12") },
      });

      const r = await bootstrapFirstAdmin(db, input());
      expect(r.ok).toBe(true);
      if (!r.ok) throw new Error("unreachable");
      expect(await userRow(r.userId)).toMatchObject({ email: "dev@example.com", role: "developer", name: "Тони" });

      expect(await isBootstrapOpen(db, SETUP_TOKEN)).toBe(false);
      expect(await bootstrapFirstAdmin(db, input({ email: "other@example.com" }))).toEqual({ ok: false, error: "closed" });

      // The new developer must enrol 2FA before using the panel.
      const login1 = await attempt("dev@example.com", PASSWORD, NOW);
      expect(login1).toMatchObject({ ok: true, next: "/admin/2fa/nastroyka" });
    });

    it("is race-safe: concurrent requests create exactly one user", async () => {
      const results = await Promise.all([
        bootstrapFirstAdmin(db, input({ email: "a@example.com" })),
        bootstrapFirstAdmin(db, input({ email: "b@example.com" })),
        bootstrapFirstAdmin(db, input({ email: "c@example.com" })),
      ]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(await db.select().from(adminUsers)).toHaveLength(1);
    });
  });
});
