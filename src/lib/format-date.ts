/**
 * Bulgarian date and time formatting for the booking UI and e-mails.
 * Every value is shown in the studio's zone (Europe/Sofia — same as
 * APP_TIME_ZONE in src/lib/env.ts, repeated here so client bundles do not pull
 * in the server env module). Pure; safe on server and client.
 */

export const DISPLAY_TIME_ZONE = "Europe/Sofia";

const LOCALE = "bg-BG";
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Short weekday labels used across the site (see src/lib/hours.ts). Index 0 = Monday. */
const WEEKDAY_SHORT = ["Пон", "Вт", "Ср", "Чет", "Пет", "Съб", "Нед"] as const;
const EN_WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type DateInput = Date | string;

/**
 * Accepts a Date, an ISO instant, or a calendar date "YYYY-MM-DD". A calendar
 * date is anchored at 12:00 UTC, which is the same calendar day in Sofia all
 * year round (UTC+2 / UTC+3).
 */
export function toDate(value: DateInput): Date {
  if (value instanceof Date) return value;
  if (DATE_KEY.test(value)) return new Date(`${value}T12:00:00Z`);
  return new Date(value);
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function fmt(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { timeZone: DISPLAY_TIME_ZONE, ...options });
    formatters.set(key, f);
  }
  return f;
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? "";
}

/** "10:00" (24 h, Sofia local time). Built from parts so no locale suffix such as " ч." appears. */
export function formatTime(value: DateInput): string {
  const parts = fmt("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(toDate(value));
  return `${part(parts, "hour")}:${part(parts, "minute")}`;
}

/** "10:00 – 10:45" */
export function formatTimeRange(start: DateInput, end: DateInput): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

/** "вторник" */
export function formatWeekdayLong(value: DateInput): string {
  return fmt(LOCALE, { weekday: "long" }).format(toDate(value));
}

/** ISO day of week in Sofia: 1 = Monday … 7 = Sunday. */
export function sofiaDayOfWeek(value: DateInput): number {
  const wd = fmt("en-US", { weekday: "short" }).format(toDate(value));
  return EN_WEEKDAY.indexOf(wd as (typeof EN_WEEKDAY)[number]) + 1;
}

/** "Вт" — the short labels used on the site. */
export function formatWeekdayShort(value: DateInput): string {
  return WEEKDAY_SHORT[sofiaDayOfWeek(value) - 1] ?? "";
}

/** "13 октомври" */
export function formatDayMonth(value: DateInput): string {
  const parts = fmt(LOCALE, { day: "numeric", month: "long" }).formatToParts(toDate(value));
  return `${part(parts, "day")} ${part(parts, "month")}`;
}

/** "13" */
export function formatDayNumber(value: DateInput): string {
  return part(fmt(LOCALE, { day: "numeric" }).formatToParts(toDate(value)), "day");
}

/** "октомври 2026" */
export function formatMonthYear(value: DateInput): string {
  const parts = fmt(LOCALE, { month: "long", year: "numeric" }).formatToParts(toDate(value));
  return `${part(parts, "month")} ${part(parts, "year")}`;
}

/** "вторник, 13 октомври" (or "… 13 октомври 2026" with `year`). */
export function formatDateLong(value: DateInput, options: { year?: boolean } = {}): string {
  const d = toDate(value);
  const year = options.year ? ` ${part(fmt(LOCALE, { year: "numeric" }).formatToParts(d), "year")}` : "";
  return `${formatWeekdayLong(d)}, ${formatDayMonth(d)}${year}`;
}

/** "вторник, 13 октомври · 11:00" */
export function formatDateTime(value: DateInput): string {
  return `${formatDateLong(value)} · ${formatTime(value)}`;
}

/** Calendar date in Sofia as "YYYY-MM-DD". */
export function sofiaDateKey(value: DateInput): string {
  const parts = fmt("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(toDate(value));
  return `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}`;
}

/** "2026-10-31" + 1 → "2026-11-01" (pure calendar arithmetic). */
export function addDaysToKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "вторник" → "Вторник" */
export function capitalize(text: string): string {
  return text ? text.charAt(0).toLocaleUpperCase(LOCALE) + text.slice(1) : text;
}
