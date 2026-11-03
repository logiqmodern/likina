/** Window events between the cookie banner and the rest of the public site. */

/** „Настройки за бисквитки“ (footer, /biskvitki) → the banner opens in its settings view. */
export const OPEN_COOKIE_SETTINGS_EVENT = "lio:cookie-settings";
/** The consent cookie changed (the banner re-reads it). */
export const CONSENT_CHANGED_EVENT = "lio:consent-changed";

export function openCookieSettings(): void {
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
}
