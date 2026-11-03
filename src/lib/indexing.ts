/**
 * Search-engine indexing switch (§11). Off until launch (Phase 9): every page is
 * noindex and robots.txt disallows everything, so the test site never ends up in
 * Google. At launch set SITE_INDEXING=on on the production domain and redeploy.
 * Pages that must never be indexed (admin, manage, confirmation, landings by
 * default) keep their own noindex either way.
 */
export function siteIndexing(): boolean {
  return process.env.SITE_INDEXING === "on";
}

/** Never in search results, even after launch (also listed in robots.txt). */
export const NOINDEX_PATHS = ["/admin", "/porachka", "/kolichka", "/en/checkout", "/en/order/", "/en/cart", "/api/", "/og", "/media/"] as const;
