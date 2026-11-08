import { describe, expect, it } from 'vitest';
import { sampleTrip, setup } from './helpers';

describe('trips API', () => {
  it('creates, lists, updates and deletes a trip', async () => {
    const { call } = setup();
    const created = await call('POST', '/api/trips', sampleTrip);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ ...sampleTrip, notes: null });
    const id = created.body.id as string;

    const list = await call('GET', '/api/trips');
    expect(list.body.trips).toHaveLength(1);

    const patched = await call('PATCH', `/api/trips/${id}`, { regions: ['DE-BY', 'DE-BW'], notes: 'Beer' });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ regions: ['DE-BY', 'DE-BW'], notes: 'Beer' });

    expect((await call('DELETE', `/api/trips/${id}`)).status).toBe(204);
    expect((await call('GET', '/api/trips')).body.trips).toHaveLength(0);
    expect((await call('GET', `/api/trips/${id}`)).status).toBe(404);
  });

  it('restores a deleted trip', async () => {
    const { call } = setup();
    const { body } = await call('POST', '/api/trips', sampleTrip);
    await call('DELETE', `/api/trips/${body.id}`);
    const restored = await call('POST', `/api/trips/${body.id}/restore`);
    expect(restored.status).toBe(200);
    expect((await call('GET', '/api/trips')).body.trips).toHaveLength(1);
    expect((await call('POST', `/api/trips/${body.id}/restore`)).status).toBe(404);
  });

  it('purges trips deleted long ago', async () => {
    const { call, tripService } = setup();
    const { body } = await call('POST', '/api/trips', sampleTrip);
    await call('DELETE', `/api/trips/${body.id}`);
    expect(tripService.purgeDeleted(new Date(Date.now() - 60_000))).toBe(0);
    expect(tripService.purgeDeleted(new Date(Date.now() + 60_000))).toBe(1);
  });

  it('rejects invalid trips with field errors', async () => {
    const { call } = setup();
    const range = await call('POST', '/api/trips', { ...sampleTrip, endDate: '2024-04-01' });
    expect(range.status).toBe(400);
    expect(range.body.error.fields).toHaveProperty('endDate');

    const country = await call('POST', '/api/trips', { ...sampleTrip, country: 'ZZ', regions: [] });
    expect(country.status).toBe(400);
    expect(country.body.error.fields).toHaveProperty('country');

    const region = await call('POST', '/api/trips', { ...sampleTrip, regions: ['US-CA'] });
    expect(region.status).toBe(400);
    expect(region.body.error.fields).toHaveProperty('regions');
  });

  it('validates a patch against the stored trip', async () => {
    const { call } = setup();
    const { body } = await call('POST', '/api/trips', sampleTrip);
    const early = await call('PATCH', `/api/trips/${body.id}`, { endDate: '2024-04-30' });
    expect(early.status).toBe(400);
    expect(early.body.error.fields).toHaveProperty('endDate');

    const wrong = await call('PATCH', `/api/trips/${body.id}`, { regions: ['AT-7'] });
    expect(wrong.status).toBe(400);

    // Switching countries without new regions clears the old ones.
    const moved = await call('PATCH', `/api/trips/${body.id}`, { country: 'AT' });
    expect(moved.body).toMatchObject({ country: 'AT', regions: [] });
  });

  it('answers unknown ids and routes with 404', async () => {
    const { call } = setup();
    expect(
      (await call('PATCH', '/api/trips/2b1f0f7e-6b0e-4a51-9a51-111111111111', { title: 'x' })).status,
    ).toBe(404);
    expect((await call('GET', '/api/nope')).status).toBe(404);
    expect((await call('GET', '/api/health')).body).toEqual({ status: 'ok' });
  });
});
