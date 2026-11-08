import { describe, expect, it } from 'vitest';
import { daysInclusive, daysInYear, isIsoDate, todayIso } from './dates';

describe('dates', () => {
  it('validates calendar dates', () => {
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2023-02-29')).toBe(false);
    expect(isIsoDate('2024-2-1')).toBe(false);
  });
  it('counts days inclusively', () => {
    expect(daysInclusive('2024-05-01', '2024-05-01')).toBe(1);
    expect(daysInclusive('2024-03-30', '2024-04-02')).toBe(4);
  });
  it('splits days across years', () => {
    expect(daysInYear('2023-12-30', '2024-01-02', 2023)).toBe(2);
    expect(daysInYear('2023-12-30', '2024-01-02', 2024)).toBe(2);
    expect(daysInYear('2023-12-30', '2024-01-02', 2025)).toBe(0);
  });
  it('formats today in local time', () => {
    expect(todayIso(new Date(2024, 0, 5, 23, 59))).toBe('2024-01-05');
  });
});
