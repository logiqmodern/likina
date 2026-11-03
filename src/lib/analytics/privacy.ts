/*
 * Privacy helpers for the browser trackers. Pure.
 *  - The manage page URL (/rezervaciya/<token>) contains a secret: it is never
 *    sent to Google or Meta as is.
 *  - When consent is withdrawn, the cookies the tools left behind are deleted.
 */

const MANAGE_PREFIX = "/rezervaciya/";

/** Pages whose URL must not reach third parties (the Meta Pixel is not loaded there at all). */
export function isSensitivePath(pathname: string): boolean {
  return pathname.startsWith(MANAGE_PREFIX);
}

/** The page URL as reported to GA4 / Google Ads: the manage token is replaced, its query string dropped. */
export function safePageLocation(href: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return "";
  }
  if (!isSensitivePath(url.pathname)) return url.toString();
  const rest = url.pathname.slice(MANAGE_PREFIX.length).split("/").slice(1);
  url.pathname = [MANAGE_PREFIX + "[token]", ...rest].join("/");
  url.search = "";
  url.hash = "";
  return url.toString();
}

/* ── Cookie clean-up after a withdrawal ───────────────────── */

/** GA4 (analytics) */
const ANALYTICS_COOKIES = [/^_ga$/, /^_ga_[A-Za-z0-9]+$/, /^_gid$/];
/** Google Ads conversion linker, Meta Pixel (marketing) */
const MARKETING_COOKIES = [/^_gcl_[A-Za-z0-9_]+$/, /^_fbp$/, /^_fbc$/];

export function cookieNames(cookieHeader: string | null | undefined): string[] {
  if (!cookieHeader) return [];
  return cookieHeader
    .split(";")
    .map((part) => part.split("=")[0]?.trim() ?? "")
    .filter(Boolean);
}

/** Tracker cookies present in `cookieHeader` that belong to the withdrawn categories. */
export function trackerCookiesToDelete(
  cookieHeader: string | null | undefined,
  withdrawn: { analytics: boolean; marketing: boolean },
): string[] {
  const patterns = [...(withdrawn.analytics ? ANALYTICS_COOKIES : []), ...(withdrawn.marketing ? MARKETING_COOKIES : [])];
  return [...new Set(cookieNames(cookieHeader).filter((name) => patterns.some((re) => re.test(name))))];
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Domains a tracker may have set its cookies on: the host and every parent
 * domain with at least two labels ("www.example.bg" → www.example.bg,
 * example.bg). Google and Meta set theirs on the registrable domain. A public
 * suffix in the list (e.g. "co.uk") is harmless — browsers refuse it.
 * Localhost and IP addresses only have host-only cookies.
 */
export function cookieDomainCandidates(hostname: string): string[] {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!host || !host.includes(".") || IPV4.test(host) || host.includes(":")) return [];
  const labels = host.split(".");
  const out: string[] = [];
  for (let i = 0; i <= labels.length - 2; i++) out.push(labels.slice(i).join("."));
  return out;
}

/** `document.cookie` assignments that expire `name` everywhere it may live (host-only and each domain). */
export function expireCookieAssignments(name: string, hostname: string): string[] {
  const base = `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/`;
  return [base, ...cookieDomainCandidates(hostname).map((d) => `${base}; Domain=.${d}`)];
}
