import { daysInclusive, daysInYear, yearOf } from './dates';
import { continentOf, regionsOf, WORLD_COUNTRY_COUNT } from './geo';
import type { Trip } from './schemas';

type TripLike = Pick<Trip, 'id' | 'title' | 'startDate' | 'endDate' | 'country' | 'regions'> &
  Partial<Pick<Trip, 'buddies'>>;

export interface CountryVisit {
  country: string;
  trips: number;
  days: number;
  firstVisit: string;
  lastVisit: string;
  /** Distinct regions visited. */
  regions: string[];
  /** Number of regions the country has in the map data. */
  regionTotal: number;
}

export interface BuddyVisit {
  /** Buddy id. */
  buddy: string;
  trips: number;
  days: number;
  /** Distinct countries visited together, most recent first. */
  countries: string[];
  /** Start date of the latest trip together. */
  lastTrip: string;
}

export interface YearStats {
  year: number;
  trips: number;
  days: number;
  countries: number;
  newCountries: number;
}

export interface TravelStats<T extends TripLike = TripLike> {
  /** Trips that have started, in date order. */
  past: T[];
  /** Trips that start after today, soonest first. */
  upcoming: T[];
  /** Trips that are under way today. */
  current: T[];
  trips: number;
  countries: number;
  worldShare: number;
  continents: string[];
  regions: number;
  /** Days traveled, counting each calendar day once even if trips overlap; capped at today. */
  days: number;
  byCountry: CountryVisit[];
  byYear: YearStats[];
  /** Travel buddies by number of trips together. */
  byBuddy: BuddyVisit[];
  /** Trips without any travel buddy. */
  soloTrips: number;
  longest: T | undefined;
  first: T | undefined;
  latest: T | undefined;
}

/**
 * Everything the dashboard shows, derived from the trip list. Trips starting after `today` are
 * upcoming and don't count as visited; trips under way count up to `today`.
 */
export function computeStats<T extends TripLike>(all: readonly T[], today: string): TravelStats<T> {
  const sorted = [...all].sort(
    (a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate),
  );
  const past = sorted.filter((t) => t.startDate <= today);
  const upcoming = sorted.filter((t) => t.startDate > today);
  const current = past.filter((t) => t.endDate >= today);
  const clampEnd = (t: T) => (t.endDate > today ? today : t.endDate);

  const countries = new Map<string, CountryVisit & { regionSet: Set<string> }>();
  for (const t of past) {
    let v = countries.get(t.country);
    if (!v) {
      v = {
        country: t.country,
        trips: 0,
        days: 0,
        firstVisit: t.startDate,
        lastVisit: t.startDate,
        regions: [],
        regionTotal: regionsOf(t.country).length,
        regionSet: new Set(),
      };
      countries.set(t.country, v);
    }
    v.trips++;
    v.days += daysInclusive(t.startDate, clampEnd(t));
    v.lastVisit = t.startDate;
    for (const r of t.regions) v.regionSet.add(r);
  }
  const byCountry = [...countries.values()]
    .map(({ regionSet, ...v }) => ({ ...v, regions: [...regionSet].sort() }))
    .sort((a, b) => b.trips - a.trips || b.days - a.days || a.country.localeCompare(b.country));

  // Distinct travel days, so overlapping trips (e.g. a multi-country journey) aren't counted twice.
  const dayRanges = past.map((t) => [t.startDate, clampEnd(t)] as const);
  const merged: [string, string][] = [];
  for (const [s, e] of dayRanges) {
    const last = merged.at(-1);
    if (last && daysInclusive(last[1], s) <= 2) {
      if (e > last[1]) last[1] = e;
    } else merged.push([s, e]);
  }
  const days = merged.reduce((n, [s, e]) => n + daysInclusive(s, e), 0);

  const years = new Map<number, YearStats & { set: Set<string> }>();
  const seen = new Set<string>();
  if (past.length) {
    for (let y = yearOf(past[0]!.startDate); y <= yearOf(today); y++) {
      years.set(y, { year: y, trips: 0, days: 0, countries: 0, newCountries: 0, set: new Set() });
    }
  }
  for (const t of past) {
    const y = years.get(yearOf(t.startDate))!;
    y.trips++;
    y.set.add(t.country);
    if (!seen.has(t.country)) {
      seen.add(t.country);
      y.newCountries++;
    }
  }
  for (const y of years.values()) {
    y.days = merged.reduce((n, [s, e]) => n + daysInYear(s, e, y.year), 0);
  }
  const byYear = [...years.values()].map(({ set, ...y }) => ({ ...y, countries: set.size }));

  const continents = [
    ...new Set(past.map((t) => continentOf(t.country)).filter((c) => c !== undefined)),
  ].sort();

  const buddies = new Map<string, BuddyVisit>();
  for (const t of [...past].reverse()) {
    for (const id of t.buddies ?? []) {
      let b = buddies.get(id);
      if (!b) {
        b = { buddy: id, trips: 0, days: 0, countries: [], lastTrip: t.startDate };
        buddies.set(id, b);
      }
      b.trips++;
      b.days += daysInclusive(t.startDate, clampEnd(t));
      if (!b.countries.includes(t.country)) b.countries.push(t.country);
    }
  }
  const byBuddy = [...buddies.values()].sort(
    (a, b) => b.trips - a.trips || b.days - a.days || b.lastTrip.localeCompare(a.lastTrip),
  );

  let longest: T | undefined;
  for (const t of past) {
    if (!longest || daysInclusive(t.startDate, t.endDate) > daysInclusive(longest.startDate, longest.endDate))
      longest = t;
  }

  return {
    past,
    upcoming,
    current,
    trips: past.length,
    countries: countries.size,
    worldShare: Math.min(1, countries.size / WORLD_COUNTRY_COUNT),
    continents,
    regions: byCountry.reduce((n, c) => n + c.regions.length, 0),
    days,
    byCountry,
    byYear,
    byBuddy,
    soloTrips: past.filter((t) => !t.buddies?.length).length,
    longest,
    first: past[0],
    latest: past.at(-1),
  };
}
