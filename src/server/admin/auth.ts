import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { getDb } from "@/db/client";
import { type AccessOptions, decideAccess } from "./access";
import { readSessionToken } from "./cookie";
import { type AdminSessionContext, type AdminUser, readSession } from "./session";

/*
 * Server-side authorization for every admin page, layout and server action.
 * The proxy only does an optimistic redirect when the cookie is missing;
 * this is the real check (session row + user, on every request).
 *
 * Reading cookies makes the caller request-time: under Cache Components,
 * call these inside a <Suspense> boundary. React `cache` dedupes the lookup
 * within one render; Server Actions run it every time.
 */

export { ADMIN_PATHS, ROLE_LABELS, mfaRequiredFor } from "./access";
export type { AccessOptions } from "./access";
export type { AdminRole, AdminUser } from "./session";

/** The current session (password passed; 2FA may still be pending) or null. */
export const getCurrentAdmin = cache(async (): Promise<AdminSessionContext | null> => {
  // Never prerendered (also not for prefetch with cookies): session checks read the clock.
  await connection();
  const token = await readSessionToken();
  if (!token) return null;
  return readSession(getDb(), token);
});

/**
 * Returns the signed-in user, or redirects to login / the 2FA step.
 * A role outside `roles` gets a 404 (does not reveal the page exists).
 */
export async function requireAdmin(opts: AccessOptions = {}): Promise<AdminUser> {
  return (await requireAdminSession(opts)).user;
}

export async function requireAdminSession(opts: AccessOptions = {}): Promise<AdminSessionContext> {
  const decision = decideAccess(await getCurrentAdmin(), opts);
  if (decision.kind === "redirect") redirect(decision.to);
  if (decision.kind === "forbidden") notFound();
  return decision.session;
}
