"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect } from "react";
import { captureAttribution } from "@/lib/analytics/attribution-store";
import { EVENTS } from "@/lib/analytics/events";
import { pageView, readConsent, syncTrackers } from "@/lib/analytics/loader";
import { publicAnalyticsConfig } from "@/lib/analytics/public-config";
import { setAnalyticsConfig, track } from "@/lib/analytics/track";
import { CookieBanner } from "./cookie-banner";

/*
 * Measurement for the public site, the booking flow and the ad landing pages
 * (§9) — mounted by their layouts, never by the admin. Nothing third-party is
 * requested before consent; afterwards the scripts load when the browser is
 * idle (see src/lib/analytics/loader.ts), so they stay off the LCP path.
 */

let capturedThisDocument = false;

/** Reports page views on the first load and on client-side navigation (path changes only). */
function PageViews() {
  const pathname = usePathname();
  useEffect(() => {
    pageView(pathname);
  }, [pathname]);
  return null;
}

export function AnalyticsProvider({ aboveBottomBar = false }: { aboveBottomBar?: boolean }) {
  useEffect(() => {
    setAnalyticsConfig(publicAnalyticsConfig());
    const consent = readConsent();
    if (!capturedThisDocument) {
      capturedThisDocument = true;
      captureAttribution(consent);
    }
    syncTrackers(consent);
  }, []);

  // One delegated listener for elements marked up with data-track (tel: links carry data-position).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-track]") : null;
      if (!el) return;
      if (el.dataset.track === EVENTS.clickPhone) track(EVENTS.clickPhone, { position: el.dataset.position ?? "other" });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return (
    <>
      {/* Consent Mode v2 default (all denied) is set by the loader before any Google call (no inline script: CSP). */}
      <Suspense fallback={null}>
        <PageViews />
      </Suspense>
      <CookieBanner aboveBottomBar={aboveBottomBar} />
    </>
  );
}
