import { and, eq, gt, lt } from "drizzle-orm";
import type { Database } from "@/db/client";
import { adminRole, adminSessions, adminUsers } from "@/db/schema";
import { generateToken, isWellFormedToken, sha256 } from "../crypto";

/**
 * Database-backed admin sessions. The cookie carries a random 32-byte token;
 * only its sha-256 is stored, so a database leak does not yield usable
 * sessions. Lifetime is absolute (14 days); `last_seen_at` is informational.
 * Pure database logic — cookies live in ./cookie.ts.
 */

export type AdminRole = (typeof adminRole.enumValues)[number];

/** The database or an open transaction. */
export type DbExecutor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export const SESSION_TTL_MS = 14 * 24 * 3600 * 1000;
export const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;
const USER_AGENT_MAX = 200;

/** What the rest of the app may know about the signed-in user (no hashes, no secrets). */
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  totpEnabled: boolean;
}

export interface AdminSessionContext {
  sessionId: string;
  mfaVerified: boolean;
  expiresAt: Date;
  user: AdminUser;
}

export interface NewSessionInput {
  userId: string;
  mfaVerified: boolean;
  ip?: string | null;
  userAgent?: string | null;
  now?: Date;
}

export interface NewSession {
  token: string;
  sessionId: string;
  expiresAt: Date;
}

export async function createSession(db: DbExecutor, input: NewSessionInput): Promise<NewSession> {
  const now = input.now ?? new Date();
  const token = generateToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const [row] = await db
    .insert(adminSessions)
    .values({
      tokenHash: sha256(token),
      userId: input.userId,
      mfaVerified: input.mfaVerified,
      createdAt: now,
      expiresAt,
      lastSeenAt: now,
      ipHash: input.ip ? sha256(input.ip) : null,
      userAgent: input.userAgent ? input.userAgent.slice(0, USER_AGENT_MAX) : null,
    })
    .returning({ id: adminSessions.id });
  return { token, sessionId: row!.id, expiresAt };
}

/** Valid, unexpired session of an active user — or null. Refreshes `last_seen_at` at most every 5 min. */
export async function readSession(
  db: Database,
  token: string | null | undefined,
  now: Date = new Date(),
): Promise<AdminSessionContext | null> {
  if (!token || !isWellFormedToken(token)) return null;

  const [row] = await db
    .select({
      sessionId: adminSessions.id,
      mfaVerified: adminSessions.mfaVerified,
      expiresAt: adminSessions.expiresAt,
      lastSeenAt: adminSessions.lastSeenAt,
      userId: adminUsers.id,
      email: adminUsers.email,
      name: adminUsers.name,
      role: adminUsers.role,
      totpEnabledAt: adminUsers.totpEnabledAt,
      isActive: adminUsers.isActive,
    })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminUsers.id, adminSessions.userId))
    .where(and(eq(adminSessions.tokenHash, sha256(token)), gt(adminSessions.expiresAt, now)));

  if (!row || !row.isActive) return null;

  if (now.getTime() - row.lastSeenAt.getTime() >= LAST_SEEN_THROTTLE_MS) {
    await db.update(adminSessions).set({ lastSeenAt: now }).where(eq(adminSessions.id, row.sessionId));
  }

  return {
    sessionId: row.sessionId,
    mfaVerified: row.mfaVerified,
    expiresAt: row.expiresAt,
    user: {
      id: row.userId,
      email: row.email,
      name: row.name,
      role: row.role,
      totpEnabled: row.totpEnabledAt !== null,
    },
  };
}

export async function destroySession(db: Database, token: string | null | undefined): Promise<void> {
  if (!token || !isWellFormedToken(token)) return;
  await db.delete(adminSessions).where(eq(adminSessions.tokenHash, sha256(token)));
}

/** Logs a user out everywhere (password reset, deactivation, 2FA reset). */
export async function destroyUserSessions(db: Database, userId: string): Promise<void> {
  await db.delete(adminSessions).where(eq(adminSessions.userId, userId));
}

/**
 * New token for a new privilege level (login, 2FA passed). The old session,
 * if any, is deleted so a token observed before the change is worthless.
 */
export async function rotateSession(
  db: Database,
  oldToken: string | null | undefined,
  input: NewSessionInput,
): Promise<NewSession> {
  return db.transaction(async (tx) => {
    if (oldToken && isWellFormedToken(oldToken)) {
      await tx.delete(adminSessions).where(eq(adminSessions.tokenHash, sha256(oldToken)));
    }
    // Housekeeping: this user's expired sessions.
    const now = input.now ?? new Date();
    await tx
      .delete(adminSessions)
      .where(and(eq(adminSessions.userId, input.userId), lt(adminSessions.expiresAt, now)));
    return createSession(tx, input);
  });
}

/** Worker housekeeping: delete expired sessions. */
export async function pruneAdminSessions(db: Database, now: Date = new Date()): Promise<number> {
  const rows = await db
    .delete(adminSessions)
    .where(lt(adminSessions.expiresAt, now))
    .returning({ id: adminSessions.id });
  return rows.length;
}
