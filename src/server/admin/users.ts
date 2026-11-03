import { and, asc, desc, eq, gt, isNull } from "drizzle-orm";
import type { Database } from "@/db/client";
import { adminInvites, adminSessions, adminUsers } from "@/db/schema";
import { generateToken, sha256 } from "../crypto";
import { writeAudit } from "./audit";
import { bootstrapSchema, normalizeEmail } from "./login";
import { hashPassword } from "./password";
import type { AdminRole, AdminUser } from "./session";

/*
 * Admin users (§10.1). New users are invited: the inviter gets a one-time
 * link (shown once) and sends it; the invitee chooses their own password, so
 * nobody else ever knows it. 2FA enrolment then follows the normal rules.
 * - developer: invites any role, can reset another user's 2FA;
 * - owner: invites owners, (de)activates owners.
 */

export const INVITE_TTL_MS = 72 * 3600 * 1000;

export class UserAdminError extends Error {
  constructor(
    public readonly code: "forbidden" | "email_taken" | "invalid" | "not_found" | "self" | "invite_invalid",
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(code);
    this.name = "UserAdminError";
  }
}

/** Which roles `actor` may create or manage. */
export function manageableRoles(actor: AdminRole): AdminRole[] {
  if (actor === "developer") return ["developer", "owner"];
  if (actor === "owner") return ["owner"];
  return [];
}

export async function listAdminUsers(db: Database, now: Date) {
  const [users, invites] = await Promise.all([
    db
      .select({
        id: adminUsers.id,
        name: adminUsers.name,
        email: adminUsers.email,
        role: adminUsers.role,
        totpEnabled: adminUsers.totpEnabledAt,
        isActive: adminUsers.isActive,
        lastLoginAt: adminUsers.lastLoginAt,
        createdAt: adminUsers.createdAt,
      })
      .from(adminUsers)
      .orderBy(asc(adminUsers.createdAt)),
    db
      .select({
        id: adminInvites.id,
        name: adminInvites.name,
        email: adminInvites.email,
        role: adminInvites.role,
        expiresAt: adminInvites.expiresAt,
        createdBy: adminInvites.createdBy,
      })
      .from(adminInvites)
      .where(and(isNull(adminInvites.usedAt), gt(adminInvites.expiresAt, now)))
      .orderBy(desc(adminInvites.createdAt)),
  ]);
  return { users: users.map((u) => ({ ...u, totpEnabled: !!u.totpEnabled })), invites };
}

/** Returns the plain invite token — shown once, never stored. */
export async function createInvite(
  db: Database,
  actor: AdminUser,
  input: { name: string; email: string; role: AdminRole },
  now: Date,
): Promise<{ token: string; expiresAt: Date }> {
  if (!manageableRoles(actor.role).includes(input.role)) throw new UserAdminError("forbidden");
  const parsed = bootstrapSchema.pick({ name: true, email: true }).safeParse({ name: input.name, email: input.email });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    throw new UserAdminError("invalid", fieldErrors);
  }
  const email = parsed.data.email;
  const [existing] = await db.select({ id: adminUsers.id }).from(adminUsers).where(eq(adminUsers.email, email));
  if (existing) throw new UserAdminError("email_taken", { email: "Вече има потребител с този имейл." });

  const token = generateToken();
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);
  await db.transaction(async (tx) => {
    // A new invite for the same e-mail replaces older open ones.
    await tx.delete(adminInvites).where(and(eq(adminInvites.email, email), isNull(adminInvites.usedAt)));
    await tx.insert(adminInvites).values({
      tokenHash: sha256(token),
      email,
      name: parsed.data.name,
      role: input.role,
      createdBy: actor.email,
      expiresAt,
    });
    await writeAudit(tx, { actor: actor.email, action: "user.invite", entity: "admin_user", entityId: email, diff: { role: input.role } });
  });
  return { token, expiresAt };
}

export async function revokeInvite(db: Database, actor: AdminUser, inviteId: string): Promise<void> {
  if (manageableRoles(actor.role).length === 0) throw new UserAdminError("forbidden");
  await db.transaction(async (tx) => {
    const [row] = await tx.delete(adminInvites).where(and(eq(adminInvites.id, inviteId), isNull(adminInvites.usedAt))).returning();
    if (!row) throw new UserAdminError("not_found");
    if (!manageableRoles(actor.role).includes(row.role)) throw new UserAdminError("forbidden");
    await writeAudit(tx, { actor: actor.email, action: "user.invite_revoke", entity: "admin_user", entityId: row.email });
  });
}

/** For the invite page: who is being invited (null = unknown, used or expired). */
export async function findInvite(db: Database, token: string, now: Date) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const [row] = await db
    .select({ id: adminInvites.id, name: adminInvites.name, email: adminInvites.email, role: adminInvites.role })
    .from(adminInvites)
    .where(and(eq(adminInvites.tokenHash, sha256(token)), isNull(adminInvites.usedAt), gt(adminInvites.expiresAt, now)));
  return row ?? null;
}

/** The invitee sets a password; the account is created and the invite consumed (atomically). */
export async function acceptInvite(
  db: Database,
  input: { token: string; password: string },
  now: Date,
): Promise<{ userId: string; email: string }> {
  const invite = await findInvite(db, input.token, now);
  if (!invite) throw new UserAdminError("invite_invalid");
  const parsed = bootstrapSchema.pick({ password: true }).safeParse({ password: input.password });
  if (!parsed.success) throw new UserAdminError("invalid", { password: parsed.error.issues[0]?.message ?? "Невалидна парола" });
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const [used] = await tx
      .update(adminInvites)
      .set({ usedAt: now })
      .where(and(eq(adminInvites.id, invite.id), isNull(adminInvites.usedAt)))
      .returning({ id: adminInvites.id });
    if (!used) throw new UserAdminError("invite_invalid");
    const [existing] = await tx.select({ id: adminUsers.id }).from(adminUsers).where(eq(adminUsers.email, normalizeEmail(invite.email)));
    if (existing) throw new UserAdminError("email_taken");
    const [user] = await tx
      .insert(adminUsers)
      .values({ email: invite.email, name: invite.name, role: invite.role, passwordHash })
      .returning({ id: adminUsers.id });
    await writeAudit(tx, { actor: invite.email, action: "user.create", entity: "admin_user", entityId: user!.id, diff: { role: invite.role } });
    return { userId: user!.id, email: invite.email };
  });
}

async function loadTarget(db: Database, actor: AdminUser, id: string) {
  if (id === actor.id) throw new UserAdminError("self");
  const [target] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
  if (!target) throw new UserAdminError("not_found");
  if (!manageableRoles(actor.role).includes(target.role)) throw new UserAdminError("forbidden");
  return target;
}

/** Deactivating also ends all sessions of that user. */
export async function setUserActive(db: Database, actor: AdminUser, id: string, active: boolean): Promise<void> {
  const target = await loadTarget(db, actor, id);
  await db.transaction(async (tx) => {
    await tx.update(adminUsers).set({ isActive: active }).where(eq(adminUsers.id, id));
    if (!active) {
      await tx.delete(adminSessions).where(eq(adminSessions.userId, id));
      // Open invitations sent by a deactivated user stop working too.
      await tx.delete(adminInvites).where(and(eq(adminInvites.createdBy, target.email), isNull(adminInvites.usedAt)));
    }
    await writeAudit(tx, { actor: actor.email, action: active ? "user.activate" : "user.deactivate", entity: "admin_user", entityId: id });
  });
}

/** Developer only: clears 2FA (lost phone). The user enrols again at the next login. */
export async function resetUserTotp(db: Database, actor: AdminUser, id: string): Promise<void> {
  if (actor.role !== "developer") throw new UserAdminError("forbidden");
  await loadTarget(db, actor, id);
  await db.transaction(async (tx) => {
    await tx
      .update(adminUsers)
      .set({ totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null })
      .where(eq(adminUsers.id, id));
    await tx.delete(adminSessions).where(eq(adminSessions.userId, id));
    await writeAudit(tx, { actor: actor.email, action: "user.reset_2fa", entity: "admin_user", entityId: id });
  });
}
