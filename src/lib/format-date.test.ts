import { describe, expect, it } from "vitest";
import {
  addDaysToKey,
  capitalize,
  formatDateLong,
  formatDateTime,
  formatDayMonth,
  formatDayNumber,
  formatMonthYear,
  formatTime,
  formatTimeRange,
  formatWeekdayLong,
  formatWeekdayShort,
  sofiaDateKey,
  sofiaDayOfWeek,
  toDate,
} from "./format-date";

// The test runner forces TZ=UTC, so any accidental use of the host zone shows up as a UTC time.

describe("formatTime", () => {
  it("shows Sofia local time in summer (UTC+3), not UTC", () => {
    expect(formatTime("2026-10-13T08:00:00Z")).toBe("11:00");
    expect(formatTime(new Date("2026-10-13T07:00:00.000Z"))).toBe("10:00");
  });

  it("handles the autumn DST switch on 2026-10-25 (03:00 EEST → 02:00 EET)", () => {
    // Day before: still UTC+3
    expect(formatTime("2026-10-24T07:00:00Z")).toBe("10:00");
    // Same UTC hour after the switch: UTC+2
    expect(formatTime("2026-10-25T07:00:00Z")).toBe("09:00");
    expect(formatTime("2026-10-25T08:00:00Z")).toBe("10:00");
    // Around the switch itself
    expect(formatTime("2026-10-25T00:30:00Z")).toBe("03:30");
    expect(formatTime("2026-10-25T01:30:00Z")).toBe("03:30");
  });

  it("handles the spring DST switch on 2026-03-29", () => {
    expect(formatTime("2026-03-28T08:00:00Z")).toBe("10:00"); // UTC+2
    expect(formatTime("2026-03-29T08:00:00Z")).toBe("11:00"); // UTC+3
  });

  it("uses 24-hour time with leading zeros and no locale suffix", () => {
    expect(formatTime("2026-10-13T21:05:00Z")).toBe("00:05");
    expect(formatTime("2026-10-13T15:30:00Z")).toBe("18:30");
  });

  it("formats a range", () => {
    expect(formatTimeRange("2026-10-13T08:00:00Z", "2026-10-13T08:45:00Z")).toBe("11:00 – 11:45");
  });
});

describe("dates", () => {
  it("formats weekdays and day + month in Bulgarian", () => {
    expect(formatWeekdayLong("2026-10-13")).toBe("вторник");
    expect(formatDayMonth("2026-10-13")).toBe("13 октомври");
    expect(formatDateLong("2026-10-13T08:00:00Z")).toBe("вторник, 13 октомври");
    expect(formatDateLong("2026-10-13", { year: true })).toBe("вторник, 13 октомври 2026");
    expect(formatDateTime("2026-10-13T08:00:00Z")).toBe("вторник, 13 октомври · 11:00");
    expect(formatMonthYear("2026-10-13")).toBe("октомври 2026");
    expect(formatDayNumber("2026-10-05")).toBe("5");
  });

  it("uses the site's short weekday labels", () => {
    expect(formatWeekdayShort("2026-10-12")).toBe("Пон");
    expect(formatWeekdayShort("2026-10-13")).toBe("Вт");
    expect(formatWeekdayShort("2026-10-25")).toBe("Нед");
    expect(sofiaDayOfWeek("2026-10-25")).toBe(7);
    expect(sofiaDayOfWeek("2026-10-01")).toBe(4);
  });

  it("takes the calendar day in Sofia, not in UTC", () => {
    // 22:30 UTC on the 24th is already 01:30 on the 25th in Sofia (UTC+3)
    expect(sofiaDateKey("2026-10-24T22:30:00Z")).toBe("2026-10-25");
    expect(formatDateLong("2026-10-24T22:30:00Z")).toBe("неделя, 25 октомври");
    // After the switch: 22:30 UTC on the 25th is 00:30 on the 26th (UTC+2)
    expect(sofiaDateKey("2026-10-25T22:30:00Z")).toBe("2026-10-26");
    expect(sofiaDateKey("2026-10-25T21:30:00Z")).toBe("2026-10-25");
  });

  it("anchors calendar dates so they never shift", () => {
    expect(sofiaDateKey("2026-10-25")).toBe("2026-10-25");
    expect(toDate("2026-10-25").toISOString()).toBe("2026-10-25T12:00:00.000Z");
  });

  it("adds days across month and DST boundaries", () => {
    expect(addDaysToKey("2026-10-24", 1)).toBe("2026-10-25");
    expect(addDaysToKey("2026-10-25", 1)).toBe("2026-10-26");
    expect(addDaysToKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysToKey("2026-12-25", 14)).toBe("2027-01-08");
  });

  it("capitalizes", () => {
    expect(capitalize("вторник, 13 октомври")).toBe("Вторник, 13 октомври");
    expect(capitalize("")).toBe("");
  });
});
