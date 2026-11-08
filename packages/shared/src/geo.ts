import data from './geo/countries.json';

export interface Region {
  /** ISO 3166-2 code, e.g. `DE-BY`. Regions without one use a `CC~id` key from Natural Earth. */
  code: string;
  name: string;
}

export interface Country {
  /** ISO 3166-1 alpha-2 code, e.g. `DE`. */
  code: string;
  name: string;
  continent: string;
  regions: Region[];
}

export const COUNTRIES: readonly Country[] = data;

/** Sovereign states usually counted as "the world": 193 UN members plus 2 observer states. */
export const WORLD_COUNTRY_COUNT = 195;

const byCode = new Map(COUNTRIES.map((c) => [c.code, c]));
const regionsByCountry = new Map(COUNTRIES.map((c) => [c.code, new Map(c.regions.map((r) => [r.code, r]))]));

export const countryByCode = (code: string): Country | undefined => byCode.get(code);

export const regionsOf = (country: string): Region[] => byCode.get(country)?.regions ?? [];

export const regionByCode = (country: string, region: string): Region | undefined =>
  regionsByCountry.get(country)?.get(region);

export const continentOf = (country: string): string | undefined => {
  const c = byCode.get(country)?.continent;
  // Natural Earth files a few remote islands under "Seven seas"; they don't make a continent.
  return c && c !== 'Seven seas (open ocean)' ? c : undefined;
};

/** Regional-indicator flag emoji for an ISO alpha-2 code. */
export const flagOf = (country: string): string =>
  /^[A-Z]{2}$/.test(country)
    ? String.fromCodePoint(...[...country].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65))
    : '';
