import { countryByCode, daysInclusive, regionByCode } from '@globy/shared';

export const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

const displayNames = (() => {
  try {
    return new Intl.DisplayNames(undefined, { type: 'region' });
  } catch {
    return null;
  }
})();

/** The country's name in the browser's language, falling back to Natural Earth's English name. */
export function countryName(code: string): string {
  try {
    const n = displayNames?.of(code);
    if (n && n !== code) return n;
  } catch {
    // unknown to Intl
  }
  return countryByCode(code)?.name ?? code;
}

export const regionName = (country: string, code: string) => regionByCode(country, code)?.name ?? code;

const parse = (day: string) => new Date(`${day}T00:00:00`);

export const formatDay = (day: string, opts: Intl.DateTimeFormatOptions = {}) =>
  parse(day).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', ...opts });

/** "3–7 May 2024", "28 Apr – 2 May 2024", "30 Dec 2023 – 2 Jan 2024". */
export function formatRange(start: string, end: string): string {
  if (start === end) return formatDay(start);
  const s = parse(start);
  const e = parse(end);
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).formatRange(s, e);
  } catch {
    return `${formatDay(start)} – ${formatDay(end)}`;
  }
}

export const tripDays = (t: { startDate: string; endDate: string }) => daysInclusive(t.startDate, t.endDate);

export const durationText = (t: { startDate: string; endDate: string }) => plural(tripDays(t), 'day');

/** Relative phrasing for an upcoming date: "today", "tomorrow", "in 12 days", "in 3 months". */
export function untilText(day: string, today: string): string {
  const d = daysInclusive(today, day) - 1;
  if (d <= 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d < 45) return `in ${d} days`;
  if (d < 540) return `in ${Math.round(d / 30.4)} months`;
  return `in ${Math.round(d / 365)} years`;
}

/** Lower case without accents, for forgiving search ("zurich" finds "Zürich"). */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** "Anna", "Anna and Ben", "Anna, Ben and Cleo" in the user's language. */
export const nameList = (names: string[]) =>
  new Intl.ListFormat(undefined, { style: 'long', type: 'conjunction' }).format(names);
