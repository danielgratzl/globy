import { sql } from 'drizzle-orm';
import { index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const trips = sqliteTable(
  'trips',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    /** YYYY-MM-DD, kept as text so dates never shift with time zones. */
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    /** ISO 3166-1 alpha-2. */
    country: text('country').notNull(),
    /** ISO 3166-2 codes of the regions visited. */
    regions: text('regions', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    /** Ids of the travel buddies on the trip. */
    buddies: text('buddies', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    notes: text('notes'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('trips_start_idx').on(t.startDate), index('trips_deleted_idx').on(t.deletedAt)],
);

export type TripRow = typeof trips.$inferSelect;

export const buddies = sqliteTable(
  'buddies',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  // Names are unique regardless of case: "anna" and "Anna" are the same person.
  (t) => [uniqueIndex('buddies_name_idx').on(sql`${t.name} COLLATE NOCASE`)],
);

export type BuddyRow = typeof buddies.$inferSelect;
