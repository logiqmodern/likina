"use server";

import { refresh } from "next/cache";
import { connection } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { serverEnv } from "@/lib/env";
import { type ActionResult, formString, MANAGER_ROLES, runAdminAction } from "@/server/admin/action-result";
import { requestClientInfo } from "@/server/admin/cookie";
import { acceptInvite, createInvite, revokeInvite, resetUserTotp, setUserActive, UserAdminError } from "@/server/admin/users";
import { hitRateLimit, RATE_LIMITS } from "@/server/rate-limit";

/*
 * Admin users (§10.1). Owner and developer reach these actions; the server
 * module enforces who may manage whom (manageableRoles) and that only the
 * developer resets 2FA. acceptInviteAction is the one PUBLIC action here:
 * the invitee has no session — it is rate-limited per IP and needs the token.
 */

const ROLES = { roles: MANAGER_ROLES };
const uuid = z.uuid();
const roleSchema = z.enum(["owner", "developer"]);

export interface InviteCreated {
  /** one-time link — shown once, never stored in plain form */
  link: string;
  expiresAt: string;
  name: string;
  email: string;
}

/** Creates an invite (fields: name, email, role) and returns the one-time link. */
export async function inviteUserAction(_prev: ActionResult<InviteCreated> | null, fd: FormData): Promise<ActionResult<InviteCreated>> {
  return runAdminAction<InviteCreated>(ROLES, async ({ db, user, now }) => {
    const role = roleSchema.safeParse(formString(fd, "role"));
    if (!role.success) return { ok: false, message: "Провери маркираните полета.", fieldErrors: { role: "Избери роля." } };
    const name = formString(fd, "name");
    const email = formString(fd, "email");
    const { token, expiresAt } = await createInvite(db, user, { name, email, role: role.data }, now);
    refresh();
    const base = serverEnv().APP_URL.replace(/\/+$/, "");
    return {
      ok: true,
      data: { link: `${base}/admin/pokana/${token}`, expiresAt: expiresAt.toISOString(), name, email: email.trim().toLowerCase() },
      message: "Поканата е създадена. Копирай линка сега — после не може да се види отново.",
    };
  });
}

export async function revokeInviteAction(inviteId: string): Promise<ActionResult> {
  return runAdminAction<null>(ROLES, async ({ db, user }) => {
    if (!uuid.safeParse(inviteId).success) return { ok: false, message: "Поканата не е намерена." };
    await revokeInvite(db, user, inviteId);
    refresh();
    return { ok: true, data: null, message: "Поканата е отменена — линкът вече не работи." };
  });
}

/** Deactivating also signs the user out everywhere. */
export async function setUserActiveAction(userId: string, active: boolean): Promise<ActionResult> {
  return runAdminAction<null>(ROLES, async ({ db, user }) => {
    if (!uuid.safeParse(userId).success || typeof active !== "boolean") return { ok: false, message: "Потребителят не е намерен." };
    await setUserActive(db, user, userId, active);
    refresh();
    return {
      ok: true,
      data: null,
      message: active ? "Профилът е активиран." : "Профилът е деактивиран и е изведен от всички устройства.",
    };
  });
}

/** Developer only (checked by the server module): clears 2FA; the user enrols again at the next login. */
export async function resetTotpAction(userId: string): Promise<ActionResult> {
  return runAdminAction<null>(ROLES, async ({ db, user }) => {
    if (!uuid.safeParse(userId).success) return { ok: false, message: "Потребителят не е намерен." };
    await resetUserTotp(db, user, userId);
    refresh();
    return { ok: true, data: null, message: "Двуфакторният вход е нулиран. При следващия вход потребителят ще го настрои отново." };
  });
}

// ── Invite acceptance (public) ───────────────────────────

export interface AcceptInviteState {
  status: "idle" | "error" | "invalid" | "done";
  message?: string;
  fieldErrors?: Record<string, string>;
}

const GENERIC_ERROR = "Нещо се обърка. Опитай отново.";

export async function acceptInviteAction(_prev: AcceptInviteState, fd: FormData): Promise<AcceptInviteState> {
  await connection();
  const token = typeof fd.get("token") === "string" ? String(fd.get("token")) : "";
  const password = typeof fd.get("password") === "string" ? String(fd.get("password")) : "";
  const repeat = typeof fd.get("passwordRepeat") === "string" ? String(fd.get("passwordRepeat")) : "";
  const db = getDb();

  const client = await requestClientInfo();
  const limit = await hitRateLimit(db, RATE_LIMITS.login, client.ip);
  if (!limit.ok) return { status: "error", message: "Твърде много опити. Изчакай няколко минути и опитай отново." };

  if (!password) return { status: "error", message: "Поправи отбелязаните полета.", fieldErrors: { password: "Въведи парола" } };
  if (password !== repeat) {
    return { status: "error", message: "Поправи отбелязаните полета.", fieldErrors: { passwordRepeat: "Паролите не съвпадат" } };
  }

  try {
    await acceptInvite(db, { token, password }, new Date());
  } catch (error) {
    if (error instanceof UserAdminError) {
      if (error.code === "invite_invalid") return { status: "invalid" };
      if (error.code === "invalid") {
        return { status: "error", message: "Поправи отбелязаните полета.", fieldErrors: error.fieldErrors };
      }
      if (error.code === "email_taken") {
        return { status: "error", message: "Вече има профил с този имейл. Влез с него или поискай нова покана." };
      }
    }
    console.error("admin invite acceptance failed", (error as Error)?.name);
    return { status: "error", message: GENERIC_ERROR };
  }
  return { status: "done" };
}
