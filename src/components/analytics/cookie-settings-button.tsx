"use client";

import type { ReactNode } from "react";
import { openCookieSettings } from "./ui-events";

/** Reopens the cookie banner in its settings view (footer link, /biskvitki). */
export function CookieSettingsButton({ className = "", children = "Настройки за бисквитки" }: { className?: string; children?: ReactNode }) {
  return (
    <button type="button" onClick={openCookieSettings} className={className}>
      {children}
    </button>
  );
}
