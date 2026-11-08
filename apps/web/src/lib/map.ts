import { geoArea } from 'd3-geo';
import type { Feature, Geometry, MultiPolygon, Polygon, Position } from 'geojson';

/** Trip count to a step on the sequential map ramp (0 = not visited). */
export function visitLevel(trips: number): 0 | 1 | 2 | 3 | 4 {
  if (trips <= 0) return 0;
  if (trips === 1) return 1;
  if (trips === 2) return 2;
  if (trips <= 4) return 3;
  return 4;
}

export const LEVEL_LEGEND = [
  { level: 1, label: '1 trip' },
  { level: 2, label: '2' },
  { level: 3, label: '3–4' },
  { level: 4, label: '5+' },
] as const;

/**
 * The polygons that make up most of a feature, so zooming to France or the US frames the
 * mainland instead of every overseas island.
 */
export function mainPart<P>(f: Feature<Geometry, P>, share = 0.25): Feature<MultiPolygon, P> {
  const polys: Position[][][] =
    f.geometry.type === 'Polygon'
      ? [(f.geometry as Polygon).coordinates]
      : f.geometry.type === 'MultiPolygon'
        ? (f.geometry as MultiPolygon).coordinates
        : [];
  const areas = polys.map((coordinates) => geoArea({ type: 'Polygon', coordinates }));
  const max = Math.max(0, ...areas);
  const kept = polys.filter((_, i) => areas[i]! >= max * share);
  return { ...f, geometry: { type: 'MultiPolygon', coordinates: kept.length ? kept : polys } };
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
