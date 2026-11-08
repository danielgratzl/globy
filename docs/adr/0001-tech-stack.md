# 1. Technology stack

- Status: accepted
- Date: 2026-11-07

## Context

Globy is a personal travel tracker. Requirements that shape the stack:

- One user, no authentication.
- Deployed as a single Docker container with a Compose file, on a home server or NAS, including ARM machines.
- Persistent data that is easy to back up and restore.
- A polished, responsive web UI built on shadcn/ui, with micro-interactions.
- A world map that colors visited countries and drills down into first-level regions, working without any third-party tile service.

The stack follows [Stacks](https://github.com/danielgratzl/stacks) so both apps share tooling, CI and packaging.

## Decision

**One language, one repository.** TypeScript in a pnpm workspace with `apps/server`, `apps/web` and `packages/shared`. The shared package holds the Zod schemas, the country and region index, and the stats calculation. Validation and numbers are then the same on both sides, and the stats are unit-tested without a browser.

**Server: Node 22, Hono, SQLite via Drizzle (better-sqlite3).** These are the same choices as Stacks. Migrations are committed and applied at start-up. Regions are stored as a JSON array on the trip, which is simpler than a join table at this scale. Dates are stored as `YYYY-MM-DD` text so they never move with time zones.

**Web: React 19, Vite, Tailwind v4, shadcn/ui, TanStack Query, React Router.** The app loads all trips once and computes stats in memory. A lifetime of travel is a few hundred rows.

**Map: SVG with d3-geo, d3-zoom and topojson-client.**

- Countries use an Equal Earth projection.
- Clicking a country zooms in with an animated transition and lazy-loads that country's regions.
- SVG makes hover, fill transitions and click targets easy, and needs no WebGL or tile server.
- The content security policy stays `connect-src 'self'`.

**Geodata: Natural Earth, pre-processed and committed.**

- `scripts/build-geo.ts` uses mapshaper to download, simplify and split the admin-0 (1:50m) and admin-1 (1:10m) datasets into TopoJSON. The result is about 0.2 MB for the world and 3.7 MB for all regions, of which a country's file is usually a few to tens of kB.
- The same script writes the index in `packages/shared` that the server validates against.
- Region keys are ISO 3166-2 codes. A test checks that every indexed region has a shape.
- Natural Earth is public domain and needs no attribution.

## Alternatives considered

- **MapLibre with vector tiles.** Smoother zooming, but it needs a tile source: either a third-party service, which breaks offline use and privacy, or self-hosted tiles, which are large.
- **react-simple-maps.** Convenient, but unmaintained and awkward with React 19. The d3 modules it wraps are small enough to use directly.
- **geoBoundaries ADM1.** It uses each country's official first level (e.g. French régions), but it ships as about 200 separate downloads under mixed licences. Natural Earth is one public-domain file. Dissolving it to a coarser level per country is a possible follow-up.
- **Multiple countries per trip.** It better models a multi-country journey, but it complicates the form and the stats. A multi-country journey is logged as one trip per country, and days traveling counts overlapping days once.

## Consequences

- Backups are simple: the JSON export, or a copy of the `/data` volume.
- Region granularity follows Natural Earth, which is coarser or finer than expected for a few countries (see the README).
- Updating the map data is a deliberate step (`pnpm geo:build`), reviewed as a diff.
