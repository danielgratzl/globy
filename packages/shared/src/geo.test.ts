import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COUNTRIES, continentOf, flagOf } from './geo';

const geoDir = join(import.meta.dirname, '../../../apps/web/public/geo');
type Topo = { objects: Record<string, { geometries: { properties: Record<string, string> }[] }> };
const load = (file: string) => JSON.parse(readFileSync(join(geoDir, file), 'utf8')) as Topo;

describe('geo data', () => {
  it('has a world shape for every country', () => {
    const world = load('world.topo.json');
    const shapes = new Set(world.objects.countries!.geometries.map((g) => g.properties.iso2));
    for (const c of COUNTRIES) expect(shapes.has(c.code), c.code).toBe(true);
  });

  it('has a region shape for every region in the index', () => {
    const files = new Set(readdirSync(join(geoDir, 'admin1')));
    for (const c of COUNTRIES) {
      if (!c.regions.length) continue;
      expect(files.has(`${c.code}.topo.json`), c.code).toBe(true);
      const topo = load(`admin1/${c.code}.topo.json`);
      const shapes = new Set(topo.objects.regions!.geometries.map((g) => g.properties.code));
      for (const r of c.regions) expect(shapes.has(r.code), r.code).toBe(true);
    }
  });

  it('uses unique ISO codes', () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('knows the first-level divisions of common countries', () => {
    const count = (cc: string) => COUNTRIES.find((c) => c.code === cc)?.regions.length;
    expect(count('DE')).toBe(16);
    expect(count('US')).toBe(51);
    expect(count('AT')).toBe(9);
  });

  it('derives continents and flags', () => {
    expect(continentOf('JP')).toBe('Asia');
    expect(flagOf('DE')).toBe('🇩🇪');
  });
});
