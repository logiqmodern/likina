import type { NextConfig } from "next";
import { buildCsp, NONCE_CSP_PREFIXES, STATIC_SECURITY_HEADERS } from "./src/lib/security-headers";

const dev = process.env.NODE_ENV === "development";
/** Everything except the nonce paths (their CSP is set per request in src/proxy.ts). */
const staticCspSource = `/((?!${NONCE_CSP_PREFIXES.map((p) => p.slice(1)).join("|")}).*)`;

/** Old WordPress path → new BG path (the EN variant is derived). */
const LEGACY_REDIRECTS: Array<[string, string]> = [
  ["/galeriya", "/magazin"],
  ["/shop", "/magazin"],
  ["/shop-2", "/magazin"],
  ["/fullwidth-shop", "/magazin"],
  ["/right-sidebar-shop", "/magazin"],
  ["/about", "/za-nas"],
  ["/contact", "/kontakti"],
  ["/faq", "/chesti-vaprosi"],
  ["/privacy-policy", "/obshti-usloviya"],
  ["/privacy-policy-2", "/poveritelnost"],
  ["/shipping-returns", "/dostavka-i-vrashtane"],
  ["/shipping-information", "/dostavka-i-vrashtane"],
  ["/cart", "/kolichka"],
  ["/checkout", "/porachka"],
  ["/my-account/:path*", "/"],
  ["/wishlist", "/"],
  ["/compare", "/"],
  ["/blog/:path*", "/"],
  ["/product-category/:path*/hand-painted-icons", "/ikoni"],
  ["/product-category/hand-painted-icons/:path*", "/ikoni"],
  ["/product-category/available-icons/:path*", "/ikoni"],
  ["/product-category/custom-icons/:path*", "/ikona-po-porachka"],
  ["/product-category/gold-paintings-landscapes-stilllife/:path*", "/kartini-sas-zlato"],
  ["/product-category/abstract-paintings/:path*", "/abstraktni-kartini"],
  ["/product-category/premium-art-prints/:path*", "/art-printove"],
  ["/product-category/framed-art-prints/:path*", "/art-printove"],
  ["/product-category/art-prints/:path*", "/art-printove"],
  ["/product-category/:path*/gergana-nikiforova", "/avtori/gergana-nikiforova"],
  ["/product-category/gergana-nikiforova", "/avtori/gergana-nikiforova"],
  ["/product-category/:path*/rumen-bozhinov", "/avtori/rumen-bozhinov"],
  ["/product-category/rumen-bozhinov", "/avtori/rumen-bozhinov"],
  ["/product-category/:path*", "/magazin"],
];

const EN_PATHS: Record<string, string> = {
  "/magazin": "/shop",
  "/za-nas": "/about",
  "/kontakti": "/contact",
  "/chesti-vaprosi": "/faq",
  "/obshti-usloviya": "/terms",
  "/poveritelnost": "/privacy",
  "/dostavka-i-vrashtane": "/shipping-returns",
  "/kolichka": "/cart",
  "/porachka": "/checkout",
  "/ikoni": "/icons",
  "/ikona-po-porachka": "/custom-icon",
  "/kartini-sas-zlato": "/gold-paintings",
  "/abstraktni-kartini": "/abstract-paintings",
  "/art-printove": "/art-prints",
  "/avtori/gergana-nikiforova": "/artists/gergana-nikiforova",
  "/avtori/rumen-bozhinov": "/artists/rumen-bozhinov",
};

/** New EN pages that share a path with an old WordPress page — never redirect these. */
const OWN_EN = new Set(["/en/shop", "/en/about", "/en/contact", "/en/faq", "/en/cart", "/en/checkout", "/en/shipping-returns"]);

const nextConfig: NextConfig = {
  // Template redirects from the old WordPress URLs (§11); /product/<slug> is a route handler (DB lookup).
  async redirects() {
    return LEGACY_REDIRECTS.flatMap(([from, to]) => [
      { source: from, destination: to, permanent: true },
      { source: `/en${from}`, destination: to === "/" ? "/en" : `/en${EN_PATHS[to] ?? to}`, permanent: true },
    ]).filter((r) => !OWN_EN.has(r.source));
  },
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
    // Two root layouts (BG and EN) → app/global-not-found.tsx for unmatched URLs.
    globalNotFound: true,
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
