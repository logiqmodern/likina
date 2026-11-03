/**
 * Cloudflare Turnstile (invisible) verification for public forms (§3).
 * Without TURNSTILE_SECRET_KEY (local, CI, temporary Vercel preview) the check
 * is skipped; honeypot + rate limits still apply. Fails closed when configured.
 */
export async function verifyTurnstile(token: string | null | undefined, remoteIp?: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // Both keys or nothing: a secret without the public site key would reject every booking
  // (the browser never gets a widget to produce a token).
  if (!secret || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return true;
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

export function isTurnstileEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY && !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
}
