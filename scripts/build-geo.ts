/**
 * Builds the map and region data from Natural Earth (public domain).
 *
 *   pnpm geo:build
 *
 * Writes:
 *   apps/web/public/geo/world.topo.json         countries, 1:50m
 *   apps/web/public/geo/admin1/{CC}.topo.json   first-level regions per country, 1:10m simplified
 *   packages/shared/src/geo/countries.json      country and region index used for validation and pickers
 *
 * The output is committed, so builds never fetch anything. Re-run only to update the data.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
// @ts-expect-error mapshaper ships no types
import mapshaper from 'mapshaper';

const NE = 'https://naciscdn.org/naturalearth';
const SOURCES = {
  countries: `${NE}/50m/cultural/ne_50m_admin_0_countries.zip`,
  admin1: `${NE}/10m/cultural/ne_10m_admin_1_states_provinces.zip`,
};

/** Natural Earth units without an ISO code, folded into the country they are usually counted with. */
const A3_TO_ISO2: Record<string, string> = { SOL: 'SO', CYN: 'CY' };
/** Regions Natural Earth files under a different country than ISO 3166-2 does. */
const REGION_COUNTRY: Record<string, string> = { 'UA-43': 'UA', 'UA-40': 'UA' };

const root = resolve(import.meta.dirname, '..');
const webGeo = join(root, 'apps/web/public/geo');
const sharedGeo = join(root, 'packages/shared/src/geo');

type Props = Record<string, string | number | null>;
interface Topo {
  objects: Record<string, { geometries: { properties: Props }[] }>;
}

async function download(url: string, dir: string): Promise<string> {
  const file = join(dir, url.split('/').pop()!);
  console.log(`downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  const out = join(
    dir,
    file
      .replace(/\.zip$/, '')
      .split('/')
      .pop()!,
  );
  execFileSync('unzip', ['-oq', file, '-d', out]);
  return join(out, `${out.split('/').pop()}.shp`);
}

async function run(commands: string, input?: Record<string, string>): Promise<Record<string, string>> {
  const out = (await mapshaper.applyCommands(commands, input)) as Record<string, string | Buffer>;
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.toString()]));
}

interface GeoJson {
  type: 'FeatureCollection';
  features: { type: 'Feature'; properties: Props; geometry: unknown }[];
}

async function toGeoJson(shp: string): Promise<GeoJson> {
  const out = await run(`-i "${shp}" encoding=utf8 -o format=geojson out.json`);
  return JSON.parse(Object.values(out)[0]!) as GeoJson;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const validIso2 = (v: string) => /^[A-Z]{2}$/.test(v);

async function main() {
  const tmp = mkdtempSync(join(tmpdir(), 'globy-geo-'));
  try {
    const countriesShp = await download(SOURCES.countries, tmp);
    const admin1Shp = await download(SOURCES.admin1, tmp);

    // ---- countries ----
    const countriesGj = await toGeoJson(countriesShp);
    for (const f of countriesGj.features) {
      const p = f.properties;
      const eh = str(p.ISO_A2_EH);
      const a2 = str(p.ISO_A2);
      const a3 = str(p.ADM0_A3);
      const iso2 = validIso2(eh) ? eh : validIso2(a2) ? a2 : (A3_TO_ISO2[a3] ?? '');
      f.properties = { iso2, a3, name: str(p.NAME), continent: str(p.CONTINENT) };
    }
    const a3ToIso2 = new Map(countriesGj.features.map((f) => [str(f.properties.a3), str(f.properties.iso2)]));
    const world = await run(
      `-i countries.json -filter "iso2 != ''" -dissolve2 iso2 copy-fields=name,continent ` +
        `-simplify 25% keep-shapes -rename-layers countries ` +
        `-o format=topojson quantization=20000 world.topo.json`,
      { 'countries.json': JSON.stringify(countriesGj) },
    );

    // ---- regions ----
    const admin1Gj = await toGeoJson(admin1Shp);
    for (const f of admin1Gj.features) {
      const p = f.properties;
      const iso = str(p.iso_3166_2);
      const country = REGION_COUNTRY[iso] ?? a3ToIso2.get(str(p.adm0_a3)) ?? '';
      const code =
        /^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(iso) && iso.startsWith(`${country}-`)
          ? iso
          : `${country}~${str(p.adm1_code)}`;
      f.properties = { country, code, name: str(p.name) || str(p.name_en) || str(p.gn_name) || code };
    }
    const admin1 = await run(
      `-i admin1.json -filter "country != ''" -dissolve2 code copy-fields=country,name ` +
        `-simplify interval=1500 keep-shapes -split country -o format=topojson singles quantization=20000 .`,
      { 'admin1.json': JSON.stringify(admin1Gj) },
    );
    const regionTable: { country: string; code: string; name: string }[] = [];

    // ---- write ----
    rmSync(webGeo, { recursive: true, force: true });
    mkdirSync(join(webGeo, 'admin1'), { recursive: true });
    mkdirSync(sharedGeo, { recursive: true });
    writeFileSync(join(webGeo, 'world.topo.json'), Object.values(world)[0]!);

    for (const content of Object.values(admin1)) {
      const topo = JSON.parse(content) as Topo;
      const layer = Object.values(topo.objects)[0]!;
      const cc = str(layer.geometries[0]?.properties.country);
      if (!validIso2(cc)) continue;
      const renamed = { ...topo, objects: { regions: layer } };
      writeFileSync(join(webGeo, 'admin1', `${cc}.topo.json`), JSON.stringify(renamed));
      for (const g of layer.geometries) {
        regionTable.push({ country: cc, code: str(g.properties.code), name: str(g.properties.name) });
      }
    }

    const worldTopo = JSON.parse(Object.values(world)[0]!) as Topo;
    const countries = worldTopo.objects
      .countries!.geometries.map((g) => ({
        code: str(g.properties.iso2),
        name: str(g.properties.name),
        continent: str(g.properties.continent),
        regions: regionTable
          .filter((r) => r.country === g.properties.iso2)
          .map(({ code, name }) => ({ code, name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter((c) => validIso2(c.code))
      .sort((a, b) => a.code.localeCompare(b.code));
    writeFileSync(join(sharedGeo, 'countries.json'), JSON.stringify(countries));

    // Remove region files for countries that are not on the world map.
    const known = new Set(countries.map((c) => c.code));
    for (const r of new Set(regionTable.map((r) => r.country))) {
      if (!known.has(r) && existsSync(join(webGeo, 'admin1', `${r}.topo.json`)))
        rmSync(join(webGeo, 'admin1', `${r}.topo.json`));
    }

    console.log(`\n${countries.length} countries, ${regionTable.length} regions`);
    const check = ['DE', 'US', 'AT', 'CH', 'FR', 'GB', 'IT', 'ES'];
    console.log(
      check.map((cc) => `${cc}: ${countries.find((c) => c.code === cc)?.regions.length ?? 0}`).join('  '),
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
