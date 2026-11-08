import { describe, expect, it } from 'vitest';
import { sampleTrip, setup } from './helpers';

describe('travel buddies API', () => {
  it('creates, lists and renames buddies', async () => {
    const { call } = setup();
    const anna = await call('POST', '/api/buddies', { name: '  Anna ' });
    expect(anna.status).toBe(201);
    expect(anna.body).toMatchObject({ name: 'Anna' });
    await call('POST', '/api/buddies', { name: 'ben' });

    const list = await call('GET', '/api/buddies');
    expect(list.body.buddies.map((b: { name: string }) => b.name)).toEqual(['Anna', 'ben']);

    const renamed = await call('PATCH', `/api/buddies/${anna.body.id}`, { name: 'Anna K.' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe('Anna K.');
  });

  it('rejects duplicate names regardless of case', async () => {
    const { call } = setup();
    const anna = await call('POST', '/api/buddies', { name: 'Anna' });
    const dup = await call('POST', '/api/buddies', { name: 'anna' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.fields.name).toMatch(/Anna is already/);

    const ben = await call('POST', '/api/buddies', { name: 'Ben' });
    expect((await call('PATCH', `/api/buddies/${ben.body.id}`, { name: 'ANNA' })).status).toBe(409);
    // Changing only the case of your own name is fine.
    expect((await call('PATCH', `/api/buddies/${anna.body.id}`, { name: 'ANNA' })).status).toBe(200);
  });

  it('rejects empty names and unknown ids', async () => {
    const { call } = setup();
    expect((await call('POST', '/api/buddies', { name: ' ' })).status).toBe(400);
    const missing = '00000000-0000-4000-8000-000000000000';
    expect((await call('PATCH', `/api/buddies/${missing}`, { name: 'X' })).status).toBe(404);
    expect((await call('DELETE', `/api/buddies/${missing}`)).status).toBe(404);
  });

  it('adds buddies to trips and only accepts known ones', async () => {
    const { call } = setup();
    const anna = (await call('POST', '/api/buddies', { name: 'Anna' })).body;
    const trip = await call('POST', '/api/trips', { ...sampleTrip, buddies: [anna.id, anna.id] });
    expect(trip.status).toBe(201);
    expect(trip.body.buddies).toEqual([anna.id]);

    const unknown = '00000000-0000-4000-8000-000000000000';
    const bad = await call('POST', '/api/trips', { ...sampleTrip, buddies: [unknown] });
    expect(bad.status).toBe(400);
    expect(bad.body.error.fields.buddies).toBeDefined();
    expect((await call('PATCH', `/api/trips/${trip.body.id}`, { buddies: [unknown] })).status).toBe(400);
    expect((await call('PATCH', `/api/trips/${trip.body.id}`, { buddies: [] })).body.buddies).toEqual([]);
  });

  it('takes a deleted buddy off every trip, including deleted ones', async () => {
    const { call } = setup();
    const anna = (await call('POST', '/api/buddies', { name: 'Anna' })).body;
    const ben = (await call('POST', '/api/buddies', { name: 'Ben' })).body;
    const t1 = (await call('POST', '/api/trips', { ...sampleTrip, buddies: [anna.id, ben.id] })).body;
    const t2 = (await call('POST', '/api/trips', { ...sampleTrip, buddies: [anna.id] })).body;
    await call('POST', '/api/trips', sampleTrip);
    await call('DELETE', `/api/trips/${t2.id}`);

    const res = await call('DELETE', `/api/buddies/${anna.id}`);
    expect(res.body).toEqual({ removedFromTrips: 2 });
    expect((await call('GET', `/api/trips/${t1.id}`)).body.buddies).toEqual([ben.id]);
    expect((await call('POST', `/api/trips/${t2.id}/restore`)).body.buddies).toEqual([]);
    expect((await call('GET', '/api/buddies')).body.buddies).toHaveLength(1);
  });
});

describe('backup with travel buddies', () => {
  it('round-trips buddies', async () => {
    const a = setup();
    const anna = (await a.call('POST', '/api/buddies', { name: 'Anna' })).body;
    await a.call('POST', '/api/trips', { ...sampleTrip, buddies: [anna.id] });
    const backup = (await a.call('GET', '/api/export')).body;
    expect(backup.buddies).toEqual([anna]);

    const b = setup();
    expect((await b.call('POST', '/api/import', { mode: 'replace', backup })).status).toBe(200);
    expect((await b.call('GET', '/api/buddies')).body.buddies).toEqual([anna]);
    expect((await b.call('GET', '/api/trips')).body.trips).toEqual(backup.trips);
  });

  it('matches buddies by name when merging', async () => {
    const a = setup();
    const annaA = (await a.call('POST', '/api/buddies', { name: 'Anna' })).body;
    await a.call('POST', '/api/trips', { ...sampleTrip, buddies: [annaA.id] });
    const backup = (await a.call('GET', '/api/export')).body;

    const b = setup();
    const annaB = (await b.call('POST', '/api/buddies', { name: 'anna' })).body;
    expect((await b.call('POST', '/api/import', { mode: 'merge', backup })).status).toBe(200);
    expect((await b.call('GET', '/api/buddies')).body.buddies).toEqual([annaB]);
    expect((await b.call('GET', '/api/trips')).body.trips[0].buddies).toEqual([annaB.id]);
  });

  it('replaces buddies when asked', async () => {
    const a = setup();
    await a.call('POST', '/api/trips', sampleTrip);
    const backup = (await a.call('GET', '/api/export')).body;
    const b = setup();
    await b.call('POST', '/api/buddies', { name: 'Ben' });
    await b.call('POST', '/api/import', { mode: 'replace', backup });
    expect((await b.call('GET', '/api/buddies')).body.buddies).toEqual([]);
  });

  it('imports version 1 backups', async () => {
    const { call } = setup();
    const now = new Date().toISOString();
    const res = await call('POST', '/api/import', {
      backup: {
        format: 'globy-backup',
        version: 1,
        exportedAt: now,
        trips: [
          {
            ...sampleTrip,
            id: '11111111-1111-4111-8111-111111111111',
            notes: null,
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
    });
    expect(res.status).toBe(200);
    expect((await call('GET', '/api/trips')).body.trips[0].buddies).toEqual([]);
  });

  it('rejects trips pointing at buddies missing from the backup', async () => {
    const { call } = setup();
    const now = new Date().toISOString();
    const res = await call('POST', '/api/import', {
      backup: {
        format: 'globy-backup',
        version: 2,
        exportedAt: now,
        buddies: [],
        trips: [
          {
            ...sampleTrip,
            id: '11111111-1111-4111-8111-111111111111',
            buddies: ['22222222-2222-4222-8222-222222222222'],
            notes: null,
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
    });
    expect(res.status).toBe(400);
    expect((await call('GET', '/api/trips')).body.trips).toHaveLength(0);
  });
});
