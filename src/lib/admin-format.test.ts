import { describe, expect, it } from "vitest";
import { formatDateRange, formatLongDate, formatRecent, formatShortDate, formatTime } from "./admin-format";

describe("admin formatting (Europe/Sofia)", () => {
  it("formats times in the studio's zone", () => {
    expect(formatTime(new Date("2026-10-14T07:05:00Z"))).toBe("10:05"); // UTC+3
    expect(formatTime(new Date("2026-12-01T07:05:00Z"))).toBe("09:05"); // UTC+2
  });

  it("formats dates in Bulgarian", () => {
    expect(formatLongDate("2026-10-14")).toBe("Сряда, 14 октомври 2026");
    expect(formatShortDate("2026-10-15")).toBe("Чт 15 окт");
    expect(formatDateRange("2026-10-12", "2026-10-18")).toBe("12–18 окт");
    expect(formatDateRange("2026-09-28", "2026-10-04")).toBe("28 сеп – 4 окт");
  });

  it("formats recent instants relative to today", () => {
    const now = new Date("2026-10-14T09:00:00Z");
    expect(formatRecent(new Date("2026-10-14T06:14:00Z"), now)).toBe("днес, 09:14");
    expect(formatRecent(new Date("2026-10-13T15:40:00Z"), now)).toBe("вчера, 18:40");
    expect(formatRecent(new Date("2026-10-09T15:40:00Z"), now)).toBe("9 окт, 18:40");
    // 21:30 UTC on the 13th is already 00:30 on the 14th in Sofia
    expect(formatRecent(new Date("2026-10-13T21:30:00Z"), now)).toBe("днес, 00:30");
  });
});

describe("admin list formatting", () => {
  it("gives the Sofia calendar date of an instant", async () => {
    const { localDateOfInstant, formatNumericDate } = await import("./admin-format");
    expect(localDateOfInstant(new Date("2026-10-13T21:30:00Z"))).toBe("2026-10-14");
    expect(formatNumericDate(new Date("2026-10-13T21:30:00Z"))).toBe("14.10.2026");
    expect(formatNumericDate(new Date("2026-03-05T10:00:00Z"))).toBe("05.03.2026");
  });

  it("shows the last valid day of a package (exclusive end)", async () => {
    const { lastValidDate } = await import("./admin-format");
    // local midnight 1 Nov 2026 (UTC+2) → valid through 31 Oct
    expect(lastValidDate(new Date("2026-10-31T22:00:00Z"))).toBe("2026-10-31");
  });
});

describe("schedule and price formatting", () => {
  it("formats date + time and durations", async () => {
    const { formatNumericDateTime, formatMinutes } = await import("./admin-format");
    expect(formatNumericDateTime(new Date("2026-10-14T07:05:00Z"))).toBe("14.10.2026, 10:05");
    expect(formatMinutes(0)).toBe("0 мин");
    expect(formatMinutes(45)).toBe("45 мин");
    expect(formatMinutes(120)).toBe("2 ч");
    expect(formatMinutes(90)).toBe("1 ч 30 мин");
  });

  it("formats closures in Sofia time", async () => {
    const { formatClosureRange } = await import("./admin-format");
    // whole days: local midnights (UTC+2 in December)
    expect(formatClosureRange(new Date("2026-12-23T22:00:00Z"), new Date("2026-12-24T22:00:00Z"))).toBe("Чт 24 дек");
    expect(formatClosureRange(new Date("2026-12-23T22:00:00Z"), new Date("2027-01-01T22:00:00Z"))).toBe(
      "Чт 24 дек – Пет 1 яну",
    );
    // across the DST change (25 Oct 2026): still whole days
    expect(formatClosureRange(new Date("2026-10-23T21:00:00Z"), new Date("2026-10-25T22:00:00Z"))).toBe(
      "Съб 24 окт – Нед 25 окт",
    );
    // partial blocks
    expect(formatClosureRange(new Date("2026-10-15T07:00:00Z"), new Date("2026-10-15T09:00:00Z"))).toBe(
      "Чт 15 окт, 10:00–12:00",
    );
    expect(formatClosureRange(new Date("2026-10-15T07:00:00Z"), new Date("2026-10-16T09:00:00Z"))).toBe(
      "Чт 15 окт 10:00 – Пет 16 окт 12:00",
    );
  });
});
