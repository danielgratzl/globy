import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';

export interface CountryProps {
  iso2: string;
  name: string;
  continent: string;
}
export interface RegionProps {
  code: string;
  name: string;
  country: string;
}

export type CountryFeature = Feature<Geometry, CountryProps>;
export type RegionFeature = Feature<Geometry, RegionProps>;

const cache = new Map<string, Promise<unknown>>();

function load<P>(url: string, object: string): Promise<Feature<Geometry, P>[]> {
  let p = cache.get(url) as Promise<Feature<Geometry, P>[]> | undefined;
  if (!p) {
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Couldn’t load map data (${r.status}).`);
        return r.json() as Promise<Topology>;
      })
      .then((topo) => (feature(topo, topo.objects[object]!) as FeatureCollection<Geometry, P>).features);
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

export const loadWorld = () => load<CountryProps>('/geo/world.topo.json', 'countries');
export const loadRegions = (country: string) =>
  load<RegionProps>(`/geo/admin1/${country}.topo.json`, 'regions');
