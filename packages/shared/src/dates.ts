const DAY = 86_400_000;

/** Today's date as `YYYY-MM-DD` in local time. */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whether a string is a real calendar date in `YYYY-MM-DD` form. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const t = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === value;
}

const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Number of calendar days from start to end, counting both. */
export function daysInclusive(start: string, end: string): number {
  return Math.round((utc(end) - utc(start)) / DAY) + 1;
}

/** Days of [start, end] that fall within the given year. */
export function daysInYear(start: string, end: string, year: number): number {
  const from = start > `${year}-01-01` ? start : `${year}-01-01`;
  const to = end < `${year}-12-31` ? end : `${year}-12-31`;
  return from > to ? 0 : daysInclusive(from, to);
}

export const yearOf = (iso: string): number => Number(iso.slice(0, 4));
