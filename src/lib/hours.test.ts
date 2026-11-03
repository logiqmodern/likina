import { describe, expect, it } from "vitest";
import { formatWeeklyHours } from "./hours";

const row = (dayOfWeek: number, openTime: string, closeTime: string) => ({ dayOfWeek, openTime, closeTime });

describe("formatWeeklyHours", () => {
  it("groups the studio's hours", () => {
    const rows = [1, 2, 3, 4, 5].map((d) => row(d, "10:00:00", "19:00:00")).concat([
      row(6, "10:00:00", "18:00:00"),
      row(7, "10:00:00", "18:00:00"),
    ]);
    expect(formatWeeklyHours(rows)).toEqual([
      { days: "Пон–Пет", hours: "10:00–19:00" },
      { days: "Съб–Нед", hours: "10:00–18:00" },
    ]);
  });

  it("shows missing days as closed and single days on their own", () => {
    const rows = [row(1, "10:00", "19:00"), row(2, "10:00", "19:00"), row(4, "12:00", "16:00")];
    expect(formatWeeklyHours(rows)).toEqual([
      { days: "Пон–Вт", hours: "10:00–19:00" },
      { days: "Ср", hours: null },
      { days: "Чет", hours: "12:00–16:00" },
      { days: "Пет–Нед", hours: null },
    ]);
  });
});
