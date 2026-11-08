import { describe, expect, it } from 'vitest';
import { sampleTrip, setup } from './helpers';

describe('backup', () => {
  it('round-trips an export into a fresh instance', async () => {
    const a = setup();
    await a.call('POST', '/api/trips', sampleTrip);
    await a.call('POST', '/api/trips', { ...sampleTrip, title: 'NYC', country: 'US', regions: ['US-NY'] });
    const backup = (await a.call('GET', '/api/export')).body;
    expect(backup).toMatchObject({ format: 'globy-backup', version: 2, buddies: [] });

    const b = setup();
    const result = await b.call('POST', '/api/import', { mode: 'merge', backup });
    expect(result.body).toEqual({ added: 2, updated: 0, removed: 0 });
    expect((await b.call('GET', '/api/trips')).body.trips).toEqual(backup.trips);
  });

  it('replaces existing trips when asked', async () => {
    const a = setup();
    await a.call('POST', '/api/trips', sampleTrip);
    const backup = (await a.call('GET', '/api/export')).body;

    const b = setup();
    await b.call('POST', '/api/trips', { ...sampleTrip, title: 'Other' });
    const merged = await b.call('POST', '/api/import', { mode: 'replace', backup });
    expect(merged.body).toEqual({ added: 1, updated: 0, removed: 1 });
    expect((await b.call('GET', '/api/trips')).body.trips.map((t: { title: string }) => t.title)).toEqual([
      sampleTrip.title,
    ]);
  });

  it('rejects backups with invalid trips', async () => {
    const { call } = setup();
    const res = await call('POST', '/api/import', {
      backup: {
        format: 'globy-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        trips: [{ ...sampleTrip, id: 'not-a-uuid', createdAt: 'x', updatedAt: 'y' }],
      },
    });
    expect(res.status).toBe(400);
  });
});
