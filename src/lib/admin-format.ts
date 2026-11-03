import { Temporal } from "temporal-polyfill";
import { APP_TIME_ZONE } from "./env";

/** Bulgarian date/time formatting for the admin, always in the studio's zone. */

const timeFmt = new Intl.DateTimeFormat("bg-BG", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "09:05" */
export function formatTime(instant: Date): string {
  return timeFmt.format(instant);
}

const WEEKDAYS = ["Понеделник", "Вторник", "Сряда", "Четвъртък", "Петък", "Събота", "Неделя"];
const WEEKDAYS_SHORT = ["Пон", "Вт", "Ср", "Чт", "Пет", "Съб", "Нед"];
const MONTHS = [
  "януари",
  "февруари",
  "март",
  "април",
  "май",
  "юни",
  "юли",
  "август",
  "септември",
  "октомври",
  "ноември",
  "декември",
];
const MONTHS_SHORT = ["яну", "фев", "мар", "апр", "май", "юни", "юли", "авг", "сеп", "окт", "ное", "дек"];

/** "Сряда, 14 октомври 2026" for a local YYYY-MM-DD */
export function formatLongDate(date: string): string {
  const d = Temporal.PlainDate.from(date);
  return `${WEEKDAYS[d.dayOfWeek - 1]}, ${d.day} ${MONTHS[d.month - 1]} ${d.year}`;
}

/** "Чт 15 окт" */
export function formatShortDate(date: string): string {
  const d = Temporal.PlainDate.from(date);
  return `${WEEKDAYS_SHORT[d.dayOfWeek - 1]} ${d.day} ${MONTHS_SHORT[d.month - 1]}`;
}

/** "12–18 окт" or "28 сеп – 4 окт" */
export function formatDateRange(start: string, end: string): string {
  const a = Temporal.PlainDate.from(start);
  const b = Temporal.PlainDate.from(end);
  if (a.month === b.month) return `${a.day}–${b.day} ${MONTHS_SHORT[b.month - 1]}`;
  return `${a.day} ${MONTHS_SHORT[a.month - 1]} – ${b.day} ${MONTHS_SHORT[b.month - 1]}`;
}

/** "днес, 09:14" · "вчера, 18:40" · "9 окт, 18:40" */
export function formatRecent(instant: Date, now: Date): string {
  const zoned = (i: Date) => Temporal.Instant.fromEpochMilliseconds(i.getTime()).toZonedDateTimeISO(APP_TIME_ZONE);
  const day = zoned(instant).toPlainDate();
  const today = zoned(now).toPlainDate();
  const diff = today.since(day, { largestUnit: "days" }).days;
  const time = formatTime(instant);
  if (diff === 0) return `днес, ${time}`;
  if (diff === 1) return `вчера, ${time}`;
  return `${day.day} ${MONTHS_SHORT[day.month - 1]}, ${time}`;
}

// ── Lists and profiles (bookings, customers, packages) ───

const zonedDate = (instant: Date) =>
  Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(APP_TIME_ZONE).toPlainDate();

/** Local (Europe/Sofia) calendar date of an instant: "2026-10-14" */
export function localDateOfInstant(instant: Date): string {
  return zonedDate(instant).toString();
}

/** "14.10.2026" */
export function formatNumericDate(instant: Date): string {
  const d = zonedDate(instant);
  return `${String(d.day).padStart(2, "0")}.${String(d.month).padStart(2, "0")}.${d.year}`;
}

/**
 * A package's `validUntil` is an exclusive instant (local midnight after the
 * last valid day). Returns that last valid day as "YYYY-MM-DD".
 */
export function lastValidDate(validUntil: Date): string {
  return localDateOfInstant(new Date(validUntil.getTime() - 1));
}

// ── Prices, schedule and settings ────────────────────────

/** "14.10.2026, 10:05" */
export function formatNumericDateTime(instant: Date): string {
  return `${formatNumericDate(instant)}, ${formatTime(instant)}`;
}

/** 45 → "45 мин", 120 → "2 ч", 90 → "1 ч 30 мин", 0 → "0 мин" */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} мин`;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}

/**
 * A closure [start, end) in Sofia time. Whole local days → "Чт 24 дек" or
 * "Чт 24 дек – Пет 1 яну" (the exclusive end midnight is not shown);
 * otherwise "Чт 15 окт, 10:00–12:00" or "Чт 15 окт 10:00 – Пет 16 окт 12:00".
 */
export function formatClosureRange(start: Date, end: Date): string {
  const zoned = (i: Date) => Temporal.Instant.fromEpochMilliseconds(i.getTime()).toZonedDateTimeISO(APP_TIME_ZONE);
  const a = zoned(start);
  const b = zoned(end);
  const midnight = (z: Temporal.ZonedDateTime) => z.hour === 0 && z.minute === 0;
  if (midnight(a) && midnight(b)) {
    const first = a.toPlainDate().toString();
    const last = b.toPlainDate().subtract({ days: 1 }).toString();
    return first === last ? formatShortDate(first) : `${formatShortDate(first)} – ${formatShortDate(last)}`;
  }
  const da = a.toPlainDate().toString();
  const db = b.toPlainDate().toString();
  if (da === db) return `${formatShortDate(da)}, ${formatTime(start)}–${formatTime(end)}`;
  return `${formatShortDate(da)} ${formatTime(start)} – ${formatShortDate(db)} ${formatTime(end)}`;
}
