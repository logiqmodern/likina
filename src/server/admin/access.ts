import type { Database } from "@/db/client";
import { type AdminRole, type AdminSessionContext, type AdminUser, readSession } from "./session";

/**
 * Authorization decisions, free of Next.js APIs so they can be tested
 * against the database. `requireAdmin` in ./auth.ts turns them into
 * redirects / 404s.
 */

export const ADMIN_PATHS = {
  login: "/admin/vhod",
  mfa: "/admin/2fa",
  mfaSetup: "/admin/2fa/nastroyka",
  home: "/admin",
} as const;

export const ALL_ROLES: readonly AdminRole[] = ["owner", "developer"];
/** §14: 2FA is mandatory for both roles. */
export const MFA_REQUIRED_ROLES: readonly AdminRole[] = ["owner", "developer"];

export const ROLE_LABELS: Record<AdminRole, string> = {
  owner: "Собственик",
  developer: "Разработчик",
};

/** A second factor is needed when the role requires it or the user has enrolled anyway. */
export function mfaRequiredFor(user: Pick<AdminUser, "role" | "totpEnabled">): boolean {
  return MFA_REQUIRED_ROLES.includes(user.role) || user.totpEnabled;
}

/** Where a signed-in user still has to go before the panel opens (null = nowhere). */
export function pendingMfaStep(ctx: AdminSessionContext): string | null {
  const { user } = ctx;
  if (MFA_REQUIRED_ROLES.includes(user.role) && !user.totpEnabled) return ADMIN_PATHS.mfaSetup;
  if (!ctx.mfaVerified) return user.totpEnabled ? ADMIN_PATHS.mfa : ADMIN_PATHS.mfaSetup;
  return null;
}

export interface AccessOptions {
  /** Allowed roles; omitted = any admin role. */
  roles?: readonly AdminRole[];
  /** Only the 2FA pages and logout set this: a session that has passed the password but not 2FA. */
  allowMfaPending?: boolean;
}

export type AccessDecision =
  | { kind: "ok"; user: AdminUser; session: AdminSessionContext; mfaPending: boolean }
  | { kind: "redirect"; to: string }
  | { kind: "forbidden" };

export function decideAccess(ctx: AdminSessionContext | null, opts: AccessOptions = {}): AccessDecision {
  if (!ctx) return { kind: "redirect", to: ADMIN_PATHS.login };
  const pending = pendingMfaStep(ctx);
  if (pending && !opts.allowMfaPending) return { kind: "redirect", to: pending };
  if (opts.roles && !opts.roles.includes(ctx.user.role)) return { kind: "forbidden" };
  return { kind: "ok", user: ctx.user, session: ctx, mfaPending: pending !== null };
}

export async function checkAdminAccess(
  db: Database,
  token: string | null | undefined,
  opts: AccessOptions = {},
  now: Date = new Date(),
): Promise<AccessDecision> {
  return decideAccess(await readSession(db, token, now), opts);
}
