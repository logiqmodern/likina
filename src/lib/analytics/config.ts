import { type PublicAnalyticsConfig, publicAnalyticsConfig } from "./public-config";

/** The ids the browser trackers use. Defaults to this build's NEXT_PUBLIC_* values. */
let config: PublicAnalyticsConfig = publicAnalyticsConfig();

export function getAnalyticsConfig(): PublicAnalyticsConfig {
  return config;
}

/** Overrides the ids (the provider passes the same build values; tests may pass others). */
export function setAnalyticsConfig(c: PublicAnalyticsConfig): void {
  config = c;
}
