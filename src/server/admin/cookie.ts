import { cookies, headers } from "next/headers";
import { SESSION_TTL_MS } from "./session";

/** The admin session cookie: only the random token, never user data. */
export const SESSION_COOKIE = "likina_admin";

export async function readSessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

/** Server Functions only (cookies cannot be written while rendering). */
export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Client IP as seen by the reverse proxy (Caddy / Vercel set X-Forwarded-For). */
export async function requestClientInfo(): Promise<{ ip: string; userAgent: string | null }> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return { ip, userAgent: h.get("user-agent") };
}
