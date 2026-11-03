/** Weekly opening hours → compact Bulgarian display rows. Pure, tested. */

export interface WeeklyHoursRow {
  dayOfWeek: number; // 1 = Monday … 7 = Sunday
  openTime: string; // "10:00" or "10:00:00"
  closeTime: string;
}

export interface HoursDisplayRow {
  days: string; // "Пон–Пет", "Съб–Нед", "Нед"
  hours: string | null; // "10:00–19:00"; null = closed
}

const SHORT = ["Пон", "Вт", "Ср", "Чет", "Пет", "Съб", "Нед"];

const hhmm = (t: string) => t.slice(0, 5);

/** Groups consecutive days with identical hours. Days without a row are shown as closed. */
export function formatWeeklyHours(rows: WeeklyHoursRow[]): HoursDisplayRow[] {
  const byDay = new Map<number, string | null>();
  for (let d = 1; d <= 7; d++) byDay.set(d, null);
  for (const r of rows) byDay.set(r.dayOfWeek, `${hhmm(r.openTime)}–${hhmm(r.closeTime)}`);

  const out: HoursDisplayRow[] = [];
  let start = 1;
  for (let d = 2; d <= 8; d++) {
    if (d === 8 || byDay.get(d) !== byDay.get(start)) {
      const end = d - 1;
      out.push({
        days: start === end ? SHORT[start - 1]! : `${SHORT[start - 1]}–${SHORT[end - 1]}`,
        hours: byDay.get(start) ?? null,
      });
      start = d;
    }
  }
  return out;
}
