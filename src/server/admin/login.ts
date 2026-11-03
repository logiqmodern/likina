import { createHash, timingSafeEqual } from "node:crypto";
import { and, count, eq, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { adminUsers } from "@/db/schema";
import { hitRateLimit, RATE_LIMITS } from "../rate-limit";
import { ADMIN_PATHS, mfaRequiredFor } from "./access";
import { hashPassword, PASSWORD_MAX_LENGTH, passwordProblem, verifyAgainstDummy, verifyPassword } from "./password";
import { type AdminSessionContext, type NewSession, rotateSession } from "./session";
import { decryptSecret, encryptSecret, generateTotpSecret, matchTotpStep, totpUri } from "./totp";

/**
 * Admin authentication flows (no Next.js APIs — the server actions in
 * src/app/admin/_actions/auth.ts handle cookies and redirects).
 */

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MS = 15 * 60 * 1000;
const EMAIL_MAX = 254;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

interface ClientInfo {
  ip: string;
  userAgent?: string | null;
  /** token of the session the browser currently holds (replaced on success) */
  currentToken?: string | null;
  now?: Date;
}

// ── Password step ────────────────────────────────────────

export type LoginResult =
  | { ok: true; session: NewSession; next: string }
  | { ok: false; error: "invalid" | "locked" | "rate_limited" };

export async function login(
  db: Database,
  input: ClientInfo & { email: string; password: string },
): Promise<LoginResult> {
  const now = input.now ?? new Date();
  const email = normalizeEmail(input.email);
  const password = input.password;
  if (!email || email.length > EMAIL_MAX || !password || password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, error: "invalid" };
  }

  const byIp = await hitRateLimit(db, RATE_LIMITS.login, input.ip, now);
  const byEmail = await hitRateLimit(db, RATE_LIMITS.loginEmail, email, now);
  if (!byIp.ok || !byEmail.ok) return { ok: false, error: "rate_limited" };

  const [user] = await db
    .select({
      id: adminUsers.id,
      passwordHash: adminUsers.passwordHash,
      role: adminUsers.role,
      totpEnabledAt: adminUsers.totpEnabledAt,
      lockedUntil: adminUsers.lockedUntil,
      isActive: adminUsers.isActive,
    })
    .from(adminUsers)
    .where(eq(adminUsers.email, email));

  if (!user || !user.isActive) {
    await verifyAgainstDummy(password);
    return { ok: false, error: "invalid" };
  }

  // Locked: still pay for a hash check so timing does not tell "locked" apart.
  if (user.lockedUntil && user.lockedUntil.getTime() > now.getTime()) {
    await verifyPassword(user.passwordHash, password);
    return { ok: false, error: "locked" };
  }

  if (!(await verifyPassword(user.passwordHash, password))) {
    // Atomic: the 5th consecutive failure locks the account and restarts the count.
    await db
      .update(adminUsers)
      .set({
        failedAttempts: sql`CASE WHEN ${adminUsers.failedAttempts} + 1 >= ${MAX_FAILED_ATTEMPTS} THEN 0 ELSE ${adminUsers.failedAttempts} + 1 END`,
        lockedUntil: sql`CASE WHEN ${adminUsers.failedAttempts} + 1 >= ${MAX_FAILED_ATTEMPTS} THEN ${new Date(now.getTime() + LOCK_MS).toISOString()}::timestamptz ELSE ${adminUsers.lockedUntil} END`,
      })
      .where(eq(adminUsers.id, user.id));
    // The locking attempt itself answers "invalid", like an unknown e-mail would (no enumeration).
    return { ok: false, error: "invalid" };
  }

  await db
    .update(adminUsers)
    .set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: now })
    .where(eq(adminUsers.id, user.id));

  const needsMfa = mfaRequiredFor({ role: user.role, totpEnabled: user.totpEnabledAt !== null });
  const session = await rotateSession(db, input.currentToken, {
    userId: user.id,
    mfaVerified: !needsMfa,
    ip: input.ip,
    userAgent: input.userAgent,
    now,
  });

  const next = !needsMfa ? ADMIN_PATHS.home : user.totpEnabledAt ? ADMIN_PATHS.mfa : ADMIN_PATHS.mfaSetup;
  return { ok: true, session, next };
}

// ── Second factor ────────────────────────────────────────

export type MfaResult =
  | { ok: true; session: NewSession }
  | { ok: false; error: "invalid" | "rate_limited" | "not_enrolled" | "already_enrolled" };

/**
 * Records `step` as used — atomically, only if it is newer than the last
 * accepted step. false = replayed (or older) code.
 */
async function consumeTotpStep(db: Database, userId: string, step: number): Promise<boolean> {
  const rows = await db
    .update(adminUsers)
    .set({ totpLastStep: step })
    .where(and(eq(adminUsers.id, userId), or(isNull(adminUsers.totpLastStep), lt(adminUsers.totpLastStep, step))))
    .returning({ id: adminUsers.id });
  return rows.length === 1;
}

async function loadTotpState(db: Database, userId: string) {
  const [row] = await db
    .select({ totpSecretEnc: adminUsers.totpSecretEnc, totpEnabledAt: adminUsers.totpEnabledAt })
    .from(adminUsers)
    .where(eq(adminUsers.id, userId));
  return row ?? null;
}

/** Login step 2 for an enrolled user. Success rotates the session to a fully verified one. */
export async function verifySecondFactor(
  db: Database,
  input: ClientInfo & { ctx: AdminSessionContext; code: string; key: Buffer },
): Promise<MfaResult> {
  const now = input.now ?? new Date();
  const limit = await hitRateLimit(db, RATE_LIMITS.mfa, input.ctx.user.id, now);
  if (!limit.ok) return { ok: false, error: "rate_limited" };

  const state = await loadTotpState(db, input.ctx.user.id);
  if (!state?.totpEnabledAt || !state.totpSecretEnc) return { ok: false, error: "not_enrolled" };

  const step = matchTotpStep(decryptSecret(state.totpSecretEnc, input.key), input.code, now);
  if (step === null || !(await consumeTotpStep(db, input.ctx.user.id, step))) {
    return { ok: false, error: "invalid" };
  }

  const session = await rotateSession(db, input.currentToken, {
    userId: input.ctx.user.id,
    mfaVerified: true,
    ip: input.ip,
    userAgent: input.userAgent,
    now,
  });
  return { ok: true, session };
}

/**
 * Enrolment, step 1: the secret shown as a QR code. Stored encrypted right
 * away (not yet enabled) so the confirm step uses the same secret; repeated
 * visits show the same one. Null when the user has already enrolled.
 */
export async function getOrCreatePendingTotp(
  db: Database,
  user: { id: string; email: string },
  key: Buffer,
): Promise<{ secret: string; uri: string } | null> {
  const fresh = generateTotpSecret();
  await db
    .update(adminUsers)
    .set({ totpSecretEnc: encryptSecret(fresh, key) })
    .where(and(eq(adminUsers.id, user.id), isNull(adminUsers.totpSecretEnc), isNull(adminUsers.totpEnabledAt)));

  const state = await loadTotpState(db, user.id);
  if (!state || state.totpEnabledAt || !state.totpSecretEnc) return null;
  const secret = decryptSecret(state.totpSecretEnc, key);
  return { secret, uri: totpUri(secret, user.email) };
}

/** Enrolment, step 2: a valid code from the app enables 2FA and verifies this session. */
export async function confirmTotpEnrollment(
  db: Database,
  input: ClientInfo & { ctx: AdminSessionContext; code: string; key: Buffer },
): Promise<MfaResult> {
  const now = input.now ?? new Date();
  const userId = input.ctx.user.id;
  const limit = await hitRateLimit(db, RATE_LIMITS.mfa, userId, now);
  if (!limit.ok) return { ok: false, error: "rate_limited" };

  const state = await loadTotpState(db, userId);
  if (!state) return { ok: false, error: "not_enrolled" };
  if (state.totpEnabledAt) return { ok: false, error: "already_enrolled" };
  if (!state.totpSecretEnc) return { ok: false, error: "not_enrolled" };

  const step = matchTotpStep(decryptSecret(state.totpSecretEnc, input.key), input.code, now);
  if (step === null) return { ok: false, error: "invalid" };

  const enabled = await db
    .update(adminUsers)
    .set({ totpEnabledAt: now, totpLastStep: step })
    .where(and(eq(adminUsers.id, userId), isNull(adminUsers.totpEnabledAt)))
    .returning({ id: adminUsers.id });
  if (enabled.length === 0) return { ok: false, error: "already_enrolled" };

  const session = await rotateSession(db, input.currentToken, {
    userId,
    mfaVerified: true,
    ip: input.ip,
    userAgent: input.userAgent,
    now,
  });
  return { ok: true, session };
}

// ── First-user bootstrap (/admin/nastroyka) ──────────────

/** Constant-time comparison (digests have equal length whatever the input). */
export function setupTokenMatches(provided: string, expected: string | undefined | null): boolean {
  if (!expected) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function adminUserCount(db: Database): Promise<number> {
  const [row] = await db.select({ n: count() }).from(adminUsers);
  return row?.n ?? 0;
}

/** The setup page exists only while there is no admin user and a setup token is configured. */
export async function isBootstrapOpen(db: Database, expectedToken: string | undefined | null): Promise<boolean> {
  if (!expectedToken) return false;
  return (await adminUserCount(db)) === 0;
}

export const bootstrapSchema = z.object({
  name: z.string().trim().min(2, { error: "Въведи име" }).max(100, { error: "Най-много 100 знака" }),
  email: z
    .string()
    .trim()
    .max(EMAIL_MAX, { error: "Твърде дълъг имейл" })
    .pipe(z.email({ error: "Въведи валиден имейл адрес" }))
    .transform(normalizeEmail),
  password: z.string().superRefine((value, ctx) => {
    const problem = passwordProblem(value);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  }),
});

export type BootstrapField = keyof z.infer<typeof bootstrapSchema>;

export type BootstrapResult =
  | { ok: true; userId: string }
  | { ok: false; error: "closed" }
  | { ok: false; error: "invalid_token" }
  | { ok: false; error: "validation"; fieldErrors: Partial<Record<BootstrapField, string>> };

/** Creates the first (developer) account. Race-safe: the table is locked while checking it is empty. */
export async function bootstrapFirstAdmin(
  db: Database,
  input: { setupToken: string; expectedToken: string | undefined | null; name: string; email: string; password: string },
): Promise<BootstrapResult> {
  if (!input.expectedToken) return { ok: false, error: "closed" };
  if (!setupTokenMatches(input.setupToken, input.expectedToken)) return { ok: false, error: "invalid_token" };

  const parsed = bootstrapSchema.safeParse({ name: input.name, email: input.email, password: input.password });
  if (!parsed.success) {
    const fieldErrors: Partial<Record<BootstrapField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as BootstrapField;
      fieldErrors[field] ??= issue.message;
    }
    return { ok: false, error: "validation", fieldErrors };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  return db.transaction(async (tx) => {
    await tx.execute(sql`LOCK TABLE admin_users IN SHARE ROW EXCLUSIVE MODE`);
    const [row] = await tx.select({ n: count() }).from(adminUsers);
    if ((row?.n ?? 0) > 0) return { ok: false, error: "closed" } as const;
    const [created] = await tx
      .insert(adminUsers)
      // Bootstrap signs the user in straight away: it counts as the first login.
      .values({ email: parsed.data.email, name: parsed.data.name, passwordHash, role: "developer", lastLoginAt: new Date() })
      .returning({ id: adminUsers.id });
    return { ok: true, userId: created!.id } as const;
  });
}
