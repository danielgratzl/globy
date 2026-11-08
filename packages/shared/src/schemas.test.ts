import { describe, expect, it } from 'vitest';
import { backupSchema, buddyCreateSchema, tripCreateSchema } from './schemas';

const base = { title: 'Bavaria', startDate: '2024-05-01', endDate: '2024-05-04', country: 'DE' };

describe('tripCreateSchema', () => {
  it('accepts a valid trip and normalises it', () => {
    const r = tripCreateSchema.parse({ ...base, country: 'de', regions: ['DE-BY', 'DE-BY'], notes: '  ' });
    expect(r).toMatchObject({ country: 'DE', regions: ['DE-BY'], notes: null });
  });
  it('rejects an end before the start', () => {
    const r = tripCreateSchema.safeParse({ ...base, endDate: '2024-04-30' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['endDate']);
  });
  it('rejects unknown countries', () => {
    expect(tripCreateSchema.safeParse({ ...base, country: 'XX' }).success).toBe(false);
  });
  it('rejects regions of another country', () => {
    const r = tripCreateSchema.safeParse({ ...base, regions: ['US-CA'] });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['regions']);
  });
});

describe('travel buddies', () => {
  const anna = '7f4a3c1e-1b2d-4e5f-8a9b-0c1d2e3f4a5b';
  it('dedupes buddy ids and defaults to none', () => {
    expect(tripCreateSchema.parse(base).buddies).toEqual([]);
    expect(tripCreateSchema.parse({ ...base, buddies: [anna, anna] }).buddies).toEqual([anna]);
  });
  it('rejects buddy ids that are not uuids', () => {
    const r = tripCreateSchema.safeParse({ ...base, buddies: ['anna'] });
    expect(r.success).toBe(false);
  });
  it('trims names and rejects empty ones', () => {
    expect(buddyCreateSchema.parse({ name: '  Anna ' }).name).toBe('Anna');
    expect(buddyCreateSchema.safeParse({ name: '   ' }).success).toBe(false);
  });
  it('still reads version 1 backups', () => {
    const now = new Date().toISOString();
    const b = backupSchema.parse({
      format: 'globy-backup',
      version: 1,
      exportedAt: now,
      trips: [{ ...base, id: anna, regions: [], notes: null, createdAt: now, updatedAt: now }],
    });
    expect(b.buddies).toEqual([]);
    expect(b.trips[0]!.buddies).toEqual([]);
  });
});
