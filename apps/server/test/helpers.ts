import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase } from '../src/db/client';
import { serverRoot } from '../src/lib/paths';

const cleanups: (() => void)[] = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

export function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'globy-test-'));
  const database = openDatabase(':memory:', join(serverRoot(), 'drizzle'));
  const { app, tripService } = createApp({ db: database.db, config: { webDir: join(dir, 'no-web') } });
  cleanups.push(() => {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const call = async (
    method: string,
    path: string,
    body?: unknown,
    // Tests poke at arbitrary JSON shapes.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<{ status: number; body: any }> => {
    const res = await app.request(path, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  return { app, tripService, call };
}

export const sampleTrip = {
  title: 'Munich and the Alps',
  startDate: '2024-05-01',
  endDate: '2024-05-06',
  country: 'DE',
  regions: ['DE-BY'],
};
