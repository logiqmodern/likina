"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { serverEnv } from "@/lib/env";
import { ADMIN_PATHS, requireAdminSession } from "@/server/admin/auth";
import { clearSessionCookie, readSessionToken, requestClientInfo, setSessionCookie } from "@/server/admin/cookie";
import {
  bootstrapFirstAdmin,
  confirmTotpEnrollment,
  isBootstrapOpen,
  login,
  verifySecondFactor,
} from "@/server/admin/login";
import { destroySession, rotateSession } from "@/server/admin/session";
import { totpKeyFromEnv } from "@/server/admin/totp";
import { hitRateLimit, RATE_LIMITS } from "@/server/rate-limit";

/*
 * Admin auth server actions (use with `useActionState`). Each one is a public
 * endpoint: it validates its input and re-checks the session itself.
 * Messages are deliberately generic (no account enumeration).
 */

export interface AuthFormState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

const str = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
};

const GENERIC_ERROR = "Нещо се обърка. Опитай отново.";

// ── Login ────────────────────────────────────────────────

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = str(formData, "email");
  const password = str(formData, "password");
  if (!email.trim() || !password) {
    return {
      status: "error",
      message: "Въведи имейл и парола.",
      fieldErrors: {
        ...(email.trim() ? {} : { email: "Въведи имейл" }),
        ...(password ? {} : { password: "Въведи парола" }),
      },
      values: { email },
    };
  }

  const client = await requestClientInfo();
  let next: string;
  try {
    const result = await login(getDb(), {
      email,
      password,
      ip: client.ip,
      userAgent: client.userAgent,
      currentToken: await readSessionToken(),
    });
    if (!result.ok) {
      const message =
        result.error === "invalid"
          ? "Грешен имейл или парола."
          : "Грешен имейл или парола. Опитай отново след няколко минути.";
      return { status: "error", message, values: { email } };
    }
    await setSessionCookie(result.session.token);
    next = result.next;
  } catch (error) {
    console.error("admin login failed", error);
    return { status: "error", message: GENERIC_ERROR, values: { email } };
  }
  redirect(next);
}

// ── 2FA ──────────────────────────────────────────────────

const MFA_MESSAGES = {
  invalid: "Кодът не е верен. Провери часа на телефона и опитай с новия код.",
  rate_limited: "Твърде много опити. Изчакай няколко минути и опитай отново.",
  not_enrolled: GENERIC_ERROR,
  already_enrolled: GENERIC_ERROR,
} as const;

export async function verifyMfaAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const ctx = await requireAdminSession({ allowMfaPending: true });
  if (!ctx.user.totpEnabled) redirect(ADMIN_PATHS.mfaSetup);

  const client = await requestClientInfo();
  try {
    const result = await verifySecondFactor(getDb(), {
      ctx,
      code: str(formData, "code"),
      key: totpKeyFromEnv(),
      ip: client.ip,
      userAgent: client.userAgent,
      currentToken: await readSessionToken(),
    });
    if (!result.ok) return { status: "error", message: MFA_MESSAGES[result.error], fieldErrors: { code: MFA_MESSAGES[result.error] } };
    await setSessionCookie(result.session.token);
  } catch (error) {
    console.error("admin 2fa verify failed", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  redirect(ADMIN_PATHS.home);
}

export async function confirmTotpSetupAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const ctx = await requireAdminSession({ allowMfaPending: true });
  if (ctx.user.totpEnabled) redirect(ADMIN_PATHS.mfa);

  const client = await requestClientInfo();
  try {
    const result = await confirmTotpEnrollment(getDb(), {
      ctx,
      code: str(formData, "code"),
      key: totpKeyFromEnv(),
      ip: client.ip,
      userAgent: client.userAgent,
      currentToken: await readSessionToken(),
    });
    if (!result.ok) return { status: "error", message: MFA_MESSAGES[result.error], fieldErrors: { code: MFA_MESSAGES[result.error] } };
    await setSessionCookie(result.session.token);
  } catch (error) {
    console.error("admin 2fa enrolment failed", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  redirect(ADMIN_PATHS.home);
}

// ── Logout ───────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  // No role check needed: it only ever removes the caller's own session.
  await destroySession(getDb(), await readSessionToken());
  await clearSessionCookie();
  redirect(ADMIN_PATHS.login);
}

// ── First user bootstrap ─────────────────────────────────

export async function bootstrapAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const db = getDb();
  const expected = serverEnv().ADMIN_SETUP_TOKEN;
  const values = { name: str(formData, "name"), email: str(formData, "email") };

  const client = await requestClientInfo();
  const limit = await hitRateLimit(db, RATE_LIMITS.login, client.ip);
  if (!limit.ok) return { status: "error", message: "Твърде много опити. Изчакай няколко минути.", values };
  if (!(await isBootstrapOpen(db, expected))) redirect(ADMIN_PATHS.login);

  let result: Awaited<ReturnType<typeof bootstrapFirstAdmin>>;
  try {
    result = await bootstrapFirstAdmin(db, {
      setupToken: str(formData, "setupToken"),
      expectedToken: expected,
      name: values.name,
      email: values.email,
      password: str(formData, "password"),
    });
  } catch (error) {
    console.error("admin bootstrap failed", error);
    return { status: "error", message: GENERIC_ERROR, values };
  }

  if (!result.ok) {
    if (result.error === "closed") redirect(ADMIN_PATHS.login);
    if (result.error === "invalid_token") {
      return {
        status: "error",
        message: "Кодът за настройка не е верен.",
        fieldErrors: { setupToken: "Кодът за настройка не е верен" },
        values,
      };
    }
    return { status: "error", message: "Поправи отбелязаните полета.", fieldErrors: result.fieldErrors, values };
  }

  const session = await rotateSession(db, await readSessionToken(), {
    userId: result.userId,
    mfaVerified: false,
    ip: client.ip,
    userAgent: client.userAgent,
  });
  await setSessionCookie(session.token);
  redirect(ADMIN_PATHS.mfaSetup);
}
