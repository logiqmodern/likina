import { type NextRequest, NextResponse } from "next/server";
import { buildCsp, newNonce, usesNonceCsp } from "@/lib/security-headers";

/** Path no route matches → the site's 404 page with a real 404 status. */
const NOT_FOUND_PATH = "/__ne-e-namerena";

/** Must match SESSION_COOKIE in src/server/admin/cookie.ts (that module imports next/headers). */
const ADMIN_COOKIE = "likina_admin";
/** Admin paths reachable without a session cookie. */
const ADMIN_PUBLIC_PATHS = new Set(["/admin/vhod", "/admin/nastroyka"]);
/** Invitation links: /admin/pokana/<token> (the invitee has no session yet). */
const ADMIN_PUBLIC_PREFIXES = ["/admin/pokana/"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return withNonceCsp(request, adminProxy);
  if (usesNonceCsp(pathname)) return withNonceCsp(request, () => NextResponse.next());
  return NextResponse.next();
}

/**
 * Strict CSP with a per-request nonce (ADR 0005). Next.js reads the nonce from
 * the request's CSP header and puts it on its own scripts; the response carries
 * the same header for the browser. Redirects / rewrites keep their own behaviour.
 */
function withNonceCsp(request: NextRequest, next: (request: NextRequest) => NextResponse): NextResponse {
  const csp = buildCsp({ nonce: newNonce(), dev: process.env.NODE_ENV === "development" });
  const decided = next(request);
  if (decided.headers.has("location") || decided.headers.has("x-middleware-rewrite")) {
    decided.headers.set("Content-Security-Policy", csp);
    return decided;
  }
  const headers = new Headers(request.headers);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

/**
 * Admin: optimistic check only — no cookie → login. The real authorization
 * (session row, role, 2FA) happens in server code: requireAdmin() in every
 * admin page, layout and server action (src/server/admin/auth.ts).
 */
function adminProxy(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/\/+$/, "") || "/";

  // The first-user setup page exists only while a setup token is configured.
  if (path === "/admin/nastroyka" && !process.env.ADMIN_SETUP_TOKEN) {
    return NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url));
  }

  const isPublic = ADMIN_PUBLIC_PATHS.has(path) || ADMIN_PUBLIC_PREFIXES.some((p) => path.startsWith(p));
  if (!isPublic && !request.cookies.has(ADMIN_COOKIE)) {
    return NextResponse.redirect(new URL("/admin/vhod", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Checkout and order pages get the nonce CSP when they arrive (Phase 5).
  matcher: ["/admin/:path*", "/porachka/:path*", "/en/checkout/:path*", "/en/order/:path*"],
};
