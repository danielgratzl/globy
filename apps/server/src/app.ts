import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { etag } from 'hono/etag';
import { secureHeaders } from 'hono/secure-headers';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Config } from './config';
import type { Db } from './db/client';
import { AppError } from './lib/errors';
import { backupRoutes } from './routes/backup';
import { buddyRoutes } from './routes/buddies';
import { tripRoutes } from './routes/trips';
import { BuddyService } from './services/buddies';
import { TripService } from './services/trips';

export interface AppDeps {
  db: Db;
  config: Pick<Config, 'webDir'>;
}

export function createApp({ db, config }: AppDeps) {
  const tripService = new TripService(db);
  const buddyService = new BuddyService(db);

  const app = new Hono();

  app.use(
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
      },
      permissionsPolicy: { camera: [], microphone: [], geolocation: [] },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compress());

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: { code: err.code, message: err.message, fields: err.fields } }, err.status);
    }
    console.error(err);
    return c.json({ error: { code: 'internal', message: 'Something went wrong on the server.' } }, 500);
  });

  const api = new Hono()
    .get('/health', (c) => c.json({ status: 'ok' }))
    .route('/trips', tripRoutes(tripService))
    .route('/buddies', buddyRoutes(buddyService))
    .route('/', backupRoutes(tripService))
    // A sub-app's notFound handler isn't used once mounted, so catch unknown API paths explicitly.
    .all('*', (c) => c.json({ error: { code: 'not_found', message: 'Not found.' } }, 404));

  app.route('/api', api);

  // Serve the built web app, with client-side routing fallback.
  if (existsSync(join(config.webDir, 'index.html'))) {
    const root = relative(process.cwd(), config.webDir) || '.';
    const noCache = (_p: string, c: { header: (k: string, v: string) => void }) =>
      c.header('cache-control', 'no-cache');
    app.use(
      '/assets/*',
      serveStatic({
        root,
        onFound: (_path, c) => c.header('cache-control', 'public, max-age=31536000, immutable'),
      }),
    );
    // Map data is large and rarely changes: revalidate with an ETag instead of re-downloading.
    app.use('/geo/*', etag(), serveStatic({ root, onFound: noCache }));
    app.use('*', serveStatic({ root, onFound: noCache }));
    app.get('*', serveStatic({ root, path: 'index.html', onFound: noCache }));
  }

  return { app, tripService, buddyService };
}

export type ApiRoutes = ReturnType<typeof createApp>['app'];
