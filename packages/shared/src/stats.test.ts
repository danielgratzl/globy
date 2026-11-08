import { describe, expect, it } from 'vitest';
import { computeStats } from './stats';

let n = 0;
const trip = (country: string, startDate: string, endDate: string, regions: string[] = []) => ({
  id: String(++n),
  title: `${country} ${startDate}`,
  country,
  startDate,
  endDate,
  regions,
});

describe('computeStats', () => {
  const trips = [
    trip('DE', '2022-06-01', '2022-06-05', ['DE-BY', 'DE-BW']),
    trip('AT', '2022-06-05', '2022-06-08', ['AT-7']),
    trip('DE', '2024-01-10', '2024-01-11', ['DE-BY', 'DE-BE']),
    trip('US', '2024-12-30', '2025-01-03', ['US-NY']),
    trip('JP', '2025-03-01', '2025-03-20'),
    trip('IT', '2026-01-01', '2026-01-05'),
  ];
  const s = computeStats(trips, '2025-03-10');

  it('separates past, current and upcoming trips', () => {
    expect(s.trips).toBe(5);
    expect(s.upcoming.map((t) => t.country)).toEqual(['IT']);
    expect(s.current.map((t) => t.country)).toEqual(['JP']);
  });

  it('counts countries, continents and regions', () => {
    expect(s.countries).toBe(4);
    expect(s.continents).toEqual(['Asia', 'Europe', 'North America']);
    expect(s.regions).toBe(5);
    const de = s.byCountry.find((c) => c.country === 'DE')!;
    expect(de).toMatchObject({ trips: 2, regions: ['DE-BE', 'DE-BW', 'DE-BY'], regionTotal: 16 });
    expect(s.byCountry[0]!.country).toBe('DE');
  });

  it('counts distinct travel days up to today', () => {
    // 2022-06-01..08 (8, the overlap on the 5th counted once) + 2 + 5 + JP 2025-03-01..10 (10)
    expect(s.days).toBe(25);
  });

  it('builds a continuous per-year series', () => {
    expect(s.byYear.map((y) => y.year)).toEqual([2022, 2023, 2024, 2025]);
    expect(s.byYear.map((y) => y.trips)).toEqual([2, 0, 2, 1]);
    expect(s.byYear.map((y) => y.newCountries)).toEqual([2, 0, 1, 1]);
    expect(s.byYear.map((y) => y.days)).toEqual([8, 0, 4, 13]);
  });

  it('finds highlights', () => {
    expect(s.longest?.country).toBe('JP');
    expect(s.first?.country).toBe('DE');
    expect(s.latest?.country).toBe('JP');
  });

  it('handles no trips', () => {
    const e = computeStats([], '2025-01-01');
    expect(e).toMatchObject({ trips: 0, countries: 0, days: 0, byYear: [], longest: undefined });
  });

  it('counts trips with each travel buddy', () => {
    const b = computeStats(
      [
        { ...trip('DE', '2022-06-01', '2022-06-05'), buddies: ['anna', 'ben'] },
        { ...trip('AT', '2023-06-01', '2023-06-02'), buddies: ['anna'] },
        { ...trip('DE', '2024-06-01', '2024-06-01'), buddies: ['anna'] },
        trip('FR', '2024-07-01', '2024-07-03'),
        { ...trip('IT', '2030-01-01', '2030-01-05'), buddies: ['ben', 'cleo'] },
      ],
      '2025-01-01',
    );
    expect(b.byBuddy).toEqual([
      { buddy: 'anna', trips: 3, days: 8, countries: ['DE', 'AT'], lastTrip: '2024-06-01' },
      { buddy: 'ben', trips: 1, days: 5, countries: ['DE'], lastTrip: '2022-06-01' },
    ]);
    expect(b.soloTrips).toBe(1);
  });
});
