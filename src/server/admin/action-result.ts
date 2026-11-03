import { connection } from "next/server";
import { ZodError } from "zod";
import { getDb, type Database } from "@/db/client";
import { requireAdmin } from "./auth";
import { MediaError } from "../media";
import type { AdminRole, AdminUser } from "./session";
import { UserAdminError } from "./users";

/*
 * Shared plumbing for admin server actions: session + role check, one result
 * shape for every form, and Bulgarian messages for the domain errors.
 * Every admin server action is a public endpoint — always go through runAdminAction.
 */

export type ActionResult<T = null> =
  | { ok: true; data: T; message?: string }
  | {
      ok: false;
      message: string;
      fieldErrors?: Record<string, string>;
      /** Bulgarian warning texts the user can override ("Запиши въпреки това") */
      warnings?: string[];
    };

export interface AdminActionContext {
  user: AdminUser;
  /** recorded in audit_log / created_by */
  actor: string;
  db: Database;
  now: Date;
}

export const MANAGER_ROLES: readonly AdminRole[] = ["owner", "developer"];

const MESSAGES = {
  media: {
    too_large: "Файлът е твърде голям (до 15 MB).",
    unsupported: "Форматът не се поддържа. Качи JPG, PNG или WebP.",
    alt_required: "Добави описание (alt текст) — то е задължително.",
    not_found: "Изображението не е намерено.",
    in_use: "Изображението се използва в съдържанието. Махни го оттам и опитай пак.",
  },
  user: {
    forbidden: "Нямаш права за това действие.",
    email_taken: "Вече има потребител с този имейл.",
    invalid: "Провери маркираните полета.",
    not_found: "Потребителят не е намерен.",
    self: "Не можеш да промениш собствения си профил оттук.",
    invite_invalid: "Поканата е невалидна, използвана или изтекла.",
  },
} as const;

export const GENERIC_ERROR = "Нещо се обърка. Опитай отново.";

const cyrillic = /[Ѐ-ӿ]/;

/** Zod issues → { "field.path": "message" } (English default messages become a generic Bulgarian one). */
export function zodFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = cyrillic.test(issue.message) ? issue.message : "Невалидна стойност.";
  }
  return out;
}

export function errorResult(error: unknown): ActionResult<never> {
  if (error instanceof MediaError) {
    const where = error.usedBy.map((u) => `${u.collection}:${u.slug}`).join(", ");
    return { ok: false, message: where ? `${MESSAGES.media[error.code]} (${where})` : MESSAGES.media[error.code] };
  }
  if (error instanceof UserAdminError) return { ok: false, message: MESSAGES.user[error.code], fieldErrors: error.fieldErrors };
  if (error instanceof ZodError) {
    return { ok: false, message: "Провери маркираните полета.", fieldErrors: zodFieldErrors(error) };
  }
  throw error;
}

/**
 * Runs an admin mutation: requires a signed-in admin with one of `roles`
 * (redirects to login otherwise), then maps known errors to messages.
 * Redirect/notFound control-flow errors from Next are re-thrown untouched.
 */
export async function runAdminAction<T>(
  opts: { roles?: readonly AdminRole[] },
  fn: (ctx: AdminActionContext) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const user = await requireAdmin({ roles: opts.roles });
  await connection();
  try {
    return await fn({ user, actor: user.email, db: getDb(), now: new Date() });
  } catch (error) {
    try {
      return errorResult(error);
    } catch {
      if (isNextControlFlow(error)) throw error;
      console.error("[admin action]", error);
      return { ok: false, message: GENERIC_ERROR };
    }
  }
}

function isNextControlFlow(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"));
}

// ── FormData helpers ─────────────────────────────────────

export function formString(fd: FormData, name: string): string {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim() : "";
}

export function formOptional(fd: FormData, name: string): string | null {
  const v = formString(fd, name);
  return v === "" ? null : v;
}

export function formBool(fd: FormData, name: string): boolean {
  const v = fd.get(name);
  return v === "on" || v === "true" || v === "1";
}

/** "123,45" / "123.45" / "123" → cents; null when empty or invalid. */
export function formEuroCents(fd: FormData, name: string): number | null {
  const raw = formString(fd, name).replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const [whole, frac = ""] = raw.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function formInt(fd: FormData, name: string): number | null {
  const raw = formString(fd, name);
  return /^-?\d+$/.test(raw) ? Number(raw) : null;
}

export function formLocalDate(fd: FormData, name: string): string | null {
  const date = formString(fd, name);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}
