import { serve } from '@hono/node-server';
import { mkdirSync } from 'node:fs';
import { createApp } from './app';
import { loadConfig } from './config';
import { openDatabase } from './db/client';

const DELETED_RETENTION_MS = 30 * 24 * 3600 * 1000;
const MAINTENANCE_INTERVAL_MS = 6 * 3600 * 1000;

function main() {
  const config = loadConfig();
  mkdirSync(config.dataDir, { recursive: true });
  const database = openDatabase(config.dbFile, config.migrationsDir);
  const { app, tripService } = createApp({ db: database.db, config });

  const maintenance = () => {
    try {
      const purged = tripService.purgeDeleted(new Date(Date.now() - DELETED_RETENTION_MS));
      if (purged) console.log(`maintenance: purged ${purged} deleted trips`);
    } catch (error) {
      console.error('maintenance failed', error);
    }
  };
  maintenance();
  const timer = setInterval(maintenance, MAINTENANCE_INTERVAL_MS);
  timer.unref();

  const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
    console.log(`Globy listening on http://${info.address}:${info.port} (data in ${config.dataDir})`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    clearInterval(timer);
    server.close(() => {
      database.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
