import { z } from 'zod';
import { isIsoDate } from './dates';
import { countryByCode, regionByCode } from './geo';

export const idSchema = z.string().uuid();

const isoDate = z.string().refine(isIsoDate, 'Use a valid date (YYYY-MM-DD).');

const tripFields = z.object({
  title: z.string().trim().min(1, 'Give the trip a title.').max(200, 'Keep the title under 200 characters.'),
  startDate: isoDate,
  endDate: isoDate,
  country: z
    .string()
    .trim()
    .toUpperCase()
    .refine((c) => !!countryByCode(c), 'Pick a country from the list.'),
  regions: z.array(z.string().trim()).max(500).default([]),
  /** Ids of the travel buddies on the trip. */
  buddies: z.array(idSchema).max(100).default([]),
  notes: z
    .string()
    .max(5000)
    .nullish()
    .transform((v) => (v?.trim() ? v.trim() : null)),
});

type TripFields = z.infer<typeof tripFields>;

function checkTrip(
  t: Pick<TripFields, 'startDate' | 'endDate' | 'country' | 'regions'>,
  ctx: z.RefinementCtx,
) {
  if (isIsoDate(t.startDate) && isIsoDate(t.endDate) && t.endDate < t.startDate) {
    ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'The trip can’t end before it starts.' });
  }
  if (!countryByCode(t.country)) return;
  const unknown = t.regions.filter((r) => !regionByCode(t.country, r));
  if (unknown.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['regions'],
      message: `Not a region of ${countryByCode(t.country)!.name}: ${unknown.join(', ')}.`,
    });
  }
}

const dedupe = <T extends { regions: string[]; buddies: string[] }>(t: T): T => ({
  ...t,
  regions: [...new Set(t.regions)],
  buddies: [...new Set(t.buddies)],
});

export const tripCreateSchema = tripFields.superRefine(checkTrip).transform(dedupe);
export type TripCreate = z.input<typeof tripCreateSchema>;
export type TripInput = z.output<typeof tripCreateSchema>;

/** Patches are merged with the stored trip and validated again as a whole on the server. */
export const tripPatchSchema = tripFields.partial().strict();
export type TripPatch = z.input<typeof tripPatchSchema>;

export interface Trip {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  country: string;
  regions: string[];
  buddies: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const buddyName = z
  .string()
  .trim()
  .min(1, 'Give your travel buddy a name.')
  .max(80, 'Keep the name under 80 characters.');

export const buddyCreateSchema = z.object({ name: buddyName });
export type BuddyCreate = z.input<typeof buddyCreateSchema>;
export const buddyPatchSchema = z.object({ name: buddyName }).strict();
export type BuddyPatch = z.input<typeof buddyPatchSchema>;

export interface Buddy {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export const buddySchema = z.object({
  id: idSchema,
  name: buddyName,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const tripSchema = tripFields
  .extend({ id: idSchema, createdAt: z.string().datetime(), updatedAt: z.string().datetime() })
  .superRefine(checkTrip)
  .transform(dedupe);

export const BACKUP_FORMAT = 'globy-backup';
/** Version 2 added travel buddies; version 1 backups still import. */
export const BACKUP_VERSION = 2;

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.union([z.literal(1), z.literal(BACKUP_VERSION)]),
  exportedAt: z.string(),
  buddies: z.array(buddySchema).default([]),
  trips: z.array(tripSchema),
});
export type Backup = z.infer<typeof backupSchema>;

export const importSchema = z.object({
  mode: z.enum(['merge', 'replace']).default('merge'),
  backup: backupSchema,
});
export type ImportRequest = z.input<typeof importSchema>;

export interface ImportResult {
  added: number;
  updated: number;
  removed: number;
}

export interface ApiError {
  error: { code: string; message: string; fields?: Record<string, string> };
}
