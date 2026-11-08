# Globy

A self-hosted travel tracker. Log where you've been and see it on a map.

- **Trips** with a title, from/to dates, a country and, optionally, the first-level regions you visited: German Länder, US states, Austrian Bundesländer, Swiss cantons and so on.
- **A world map** colored by how often you've been to each country, with planned trips hatched. Click a country to zoom in and see which of its regions you've visited.
- **Stats**: countries and share of the world, trips, days traveling (overlapping trips count once), regions, continents, trips, days and new countries per year, most visited countries, region coverage per country, travel buddies, and highlights such as the longest trip, the next one, and the one you're on now.
- **Pick regions** from a searchable list or by clicking them on a map of the country.
- **Travel buddies.** Add the people you traveled with to a trip. Anyone you add once is offered on every later trip. Rename or remove them in Settings, and the dashboard shows who you travel with most.
- **Backups** as a single JSON file, merged or replacing on import.
- **Works offline.** Maps are bundled. The app makes no requests to other servers.

It is a single-user app with no login. Run it on your own machine or home server, behind your own network or reverse proxy.

## Quick start

Requires Docker with the Compose plugin.

```sh
cp .env.example .env   # optional: change the port or time zone
docker compose up -d --build
```

Open <http://localhost:8081>. Data is stored in the `globy-data` volume. The default port is 8081, so Globy can run next to [Stacks](https://github.com/danielgratzl/stacks) on 8080.

To update after pulling new code, run `docker compose up -d --build` again. Database migrations run automatically on start.

### Prebuilt image

Images for `linux/amd64` and `linux/arm64` are published to the GitHub Container Registry:

- `ghcr.io/<owner>/globy:latest` is the latest commit on `main`.
- `:1.2.3`, `:1.2` and `:1` are releases and follow that version line.

To use one instead of building locally, set `image:` in `compose.yaml` to the tag you want, remove the `build: .` line, and run `docker compose pull && docker compose up -d`.

Images are only published once the checks pass. Pushing a `v*.*.*` tag (e.g. `git tag v1.0.0 && git push origin v1.0.0`) publishes a release.

## Configuration

Compose reads these from `.env`. The server reads them from its environment.

| Variable         | Default            | Description                                       |
| ---------------- | ------------------ | ------------------------------------------------- |
| `GLOBY_PORT`     | `8081`             | Host port (Compose only).                         |
| `TZ`             | `UTC`              | Time zone of the container.                       |
| `PORT`           | `3000`             | Port the server listens on inside the container.  |
| `HOST`           | `0.0.0.0`          | Address the server binds to.                      |
| `DATA_DIR`       | `/data`            | Where the SQLite database (`globy.db`) is stored. |
| `WEB_DIR`        | `<server>/public`  | Built web app to serve.                           |
| `MIGRATIONS_DIR` | `<server>/drizzle` | SQL migrations applied on start.                  |

## Backups

The container runs as the unprivileged `node` user (uid 1000). The named volume needs nothing extra. If you bind-mount a host directory to `/data` instead, make it writable by uid 1000, e.g. `sudo chown 1000:1000 ./data`.

Use **Settings → Export** for a JSON file of all trips and travel buddies, and **Import** to restore or merge it. Backups from before travel buddies existed (format version 1) still import. When merging, a buddy whose name is already in your list, ignoring case, is treated as the same person. Or copy the volume: everything lives in `globy.db` in the data directory.

## Development

Requires Node 22 and pnpm (`corepack enable`).

```sh
pnpm install
pnpm dev          # server on :3000, web app on :5173 with /api proxied
pnpm check        # format, lint, typecheck, tests
pnpm build
```

If port 3000 is taken, run `PORT=3077 GLOBY_API=http://localhost:3077 pnpm dev`.

The repository is a pnpm workspace:

- `apps/server`: Hono API, SQLite through Drizzle. It also serves the built web app.
- `apps/web`: React, Vite, Tailwind and shadcn/ui.
- `packages/shared`: Zod schemas, the country and region index, and the stats used by the dashboard.

Schema changes: edit `apps/server/src/db/schema.ts`, then run `pnpm --filter @globy/server db:generate` and commit the new migration.

## Map data

Countries and regions come from [Natural Earth](https://www.naturalearthdata.com/), which is public domain. The processed files are committed:

- `apps/web/public/geo/world.topo.json`: countries at 1:50m.
- `apps/web/public/geo/admin1/<CC>.topo.json`: regions per country at 1:10m, simplified, loaded on demand.
- `packages/shared/src/geo/countries.json`: the index of countries and regions used for validation and pickers.

Regions are identified by their ISO 3166-2 code, e.g. `DE-BY`. Run `pnpm geo:build` to regenerate the files from the latest release. It needs `unzip`.

Natural Earth's first-level divisions don't always match what a country calls its states or regions:

- Germany, the US, Austria, Switzerland and many others have exactly their first-level divisions.
- France is split into départements, not the 13 régions.
- The UK is split into counties and unitary authorities, not England, Scotland, Wales and Northern Ireland.
- Italy and Spain are split into provinces.
- A few codes are older than the current ISO list, e.g. Mexico City is `MX-DIF`.
