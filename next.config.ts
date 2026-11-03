import type { NextConfig } from "next";
import { buildCsp, NONCE_CSP_PREFIXES, STATIC_SECURITY_HEADERS } from "./src/lib/security-headers";

const dev = process.env.NODE_ENV === "development";
/** Everything except the nonce paths (their CSP is set per request in src/proxy.ts). */
const staticCspSource = `/((?!${NONCE_CSP_PREFIXES.map((p) => p.slice(1)).join("|")}).*)`;

const nextConfig: NextConfig = {
  // Template redirects from the old WordPress URLs come in Phase 8 (docs/PROMPT.md §11).
  async headers() {
    return [
      { source: "/:path*", headers: STATIC_SECURITY_HEADERS },
      { source: staticCspSource, headers: [{ key: "Content-Security-Policy", value: buildCsp({ dev }) }] },
    ];
  },
  // Self-contained server for the Docker image (docs/PROMPT.md §3, §16).
  output: "standalone",
  // Fonts for the social preview images (src/app/og/route.tsx), read from disk at request time.
  outputFileTracingIncludes: { "/og": ["./src/assets/og-fonts/**"] },
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Media uploads (admin): the browser shrinks photos to ≤ 4 MB first (src/components/admin/media/downscale.ts).
    serverActions: { bodySizeLimit: "5mb" },
  },
  images: {
    // CMS media library (src/app/media/[id]/route.ts)
    localPatterns: [{ pathname: "/media/**" }, { pathname: "/**", search: "" }],
    formats: ["image/avif", "image/webp"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
