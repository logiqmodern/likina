/*
 * Security headers (§14). Two Content-Security-Policy variants (ADR 0005):
 *
 * - Nonce (strict): admin, booking flow and "manage my booking". These pages are
 *   rendered per request anyway, so a fresh nonce costs nothing; scripts run only
 *   with the nonce ('strict-dynamic' lets them load GA / Pixel).
 * - Static (public pages): prerendered and cached for speed (§12), so no nonce is
 *   possible — inline scripts are allowed, but only from our origin and the
 *   allow-listed trackers, with no framing, plugins or foreign form targets.
 *
 * Pure: used by next.config.ts (static headers) and src/proxy.ts (nonce).
 */

/** Third parties the site talks to (after consent, except Turnstile). */
const TRACKER_SCRIPTS = ["https://www.googletagmanager.com", "https://connect.facebook.net"];
const TURNSTILE = "https://challenges.cloudflare.com";
const CONNECT = [
  "https://*.google-analytics.com",
  "https://*.analytics.google.com",
  "https://www.googletagmanager.com",
  "https://www.google.com",
  "https://*.doubleclick.net",
  "https://www.facebook.com",
  "https://connect.facebook.net",
];
const IMAGES = [
  "https://*.google-analytics.com",
  "https://www.googletagmanager.com",
  "https://www.google.com",
  "https://www.google.bg",
  "https://*.doubleclick.net",
  "https://www.facebook.com",
];
/** Google Maps embed (contacts, booking confirmation) redirects within www.google.com. */
const FRAMES = [TURNSTILE, "https://td.doubleclick.net", "https://www.googletagmanager.com", "https://www.google.com"];

/** Paths that get the nonce CSP (set in src/proxy.ts). */
export const NONCE_CSP_PREFIXES = ["/admin", "/porachka", "/en/checkout", "/en/order"] as const;

export function usesNonceCsp(pathname: string): boolean {
  return NONCE_CSP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function buildCsp(opts: { nonce?: string; dev?: boolean }): string {
  const { nonce, dev = false } = opts;
  const eval_ = dev ? " 'unsafe-eval'" : "";
  const scriptSrc = nonce
    ? // https: is ignored by browsers that support 'strict-dynamic' (fallback for very old ones).
      `'self' 'nonce-${nonce}' 'strict-dynamic' https:${eval_}`
    : `'self' 'unsafe-inline' ${[...TRACKER_SCRIPTS, TURNSTILE].join(" ")}${eval_}`;

  const directives: Array<[string, string]> = [
    ["default-src", "'self'"],
    ["script-src", scriptSrc],
    ["style-src", "'self' 'unsafe-inline'"],
    ["img-src", `'self' data: blob: ${IMAGES.join(" ")}`],
    ["font-src", "'self'"],
    ["connect-src", `'self' ${CONNECT.join(" ")}${dev ? " ws: wss:" : ""}`],
    ["frame-src", FRAMES.join(" ")],
    ["worker-src", "'self' blob:"],
    ["manifest-src", "'self'"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["frame-ancestors", "'none'"],
  ];
  const csp = directives.map(([k, v]) => `${k} ${v}`).join("; ");
  return dev ? csp : `${csp}; upgrade-insecure-requests`;
}

/** Headers for every response (the CSP for nonce paths comes from the proxy). */
export const STATIC_SECURITY_HEADERS: Array<{ key: string; value: string }> = [
  // No includeSubDomains / preload: other subdomains (mail, cPanel) live at Superhosting.
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=(), interest-cohort=()",
  },
];

export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
