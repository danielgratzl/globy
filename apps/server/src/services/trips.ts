import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  tripCreateSchema,
  type Backup,
  type ImportResult,
  type Trip,
  type TripInput,
  type TripPatch,
} from '@globy/shared';
import { and, eq, isNotNull, isNull, lt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { Db } from '../db/client';
import { buddies, trips, type TripRow } from '../db/schema';
import { AppError, notFound, zodToApiError } from '../lib/errors';
import { assertBuddiesExist, findBuddyByName } from './buddies';

const toTrip = ({ deletedAt: _deletedAt, ...row }: TripRow): Trip => row;

export class TripService {
  constructor(private readonly db: Db) {}

  list(): Trip[] {
    return this.db
      .select()
      .from(trips)
      .where(isNull(trips.deletedAt))
      .orderBy(trips.startDate, trips.endDate)
      .all()
      .map(toTrip);
  }

  get(id: string): Trip {
    const row = this.db
      .select()
      .from(trips)
      .where(and(eq(trips.id, id), isNull(trips.deletedAt)))
      .get();
    if (!row) throw notFound('Trip');
    return toTrip(row);
  }

  create(input: TripInput): Trip {
    assertBuddiesExist(this.db, input.buddies);
    const now = new Date().toISOString();
    const row = { id: randomUUID(), ...input, createdAt: now, updatedAt: now };
    this.db.insert(trips).values(row).run();
    return this.get(row.id);
  }

  update(id: string, patch: TripPatch): Trip {
    const current = this.get(id);
    const merged = { ...current, ...patch };
    // Changing the country drops regions that no longer belong unless new ones were sent.
    if (patch.country && patch.country.toUpperCase() !== current.country && !patch.regions)
      merged.regions = [];
    const parsed = tripCreateSchema.safeParse(merged);
    if (!parsed.success) {
      const { error } = zodToApiError(parsed.error);
      throw new AppError(400, error.code, error.message, error.fields);
    }
    assertBuddiesExist(this.db, parsed.data.buddies);
    this.db
      .update(trips)
      .set({ ...parsed.data, updatedAt: new Date().toISOString() })
      .where(eq(trips.id, id))
      .run();
    return this.get(id);
  }

  remove(id: string): void {
    this.get(id);
    this.db.update(trips).set({ deletedAt: new Date().toISOString() }).where(eq(trips.id, id)).run();
  }

  restore(id: string): Trip {
    const res = this.db
      .update(trips)
      .set({ deletedAt: null })
      .where(and(eq(trips.id, id), isNotNull(trips.deletedAt)))
      .run();
    if (!res.changes) throw notFound('Deleted trip');
    return this.get(id);
  }

  /** Permanently removes trips deleted before the cutoff. */
  purgeDeleted(before: Date): number {
    return this.db
      .delete(trips)
      .where(and(isNotNull(trips.deletedAt), lt(trips.deletedAt, before.toISOString())))
      .run().changes;
  }

  exportBackup(): Backup {
    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      buddies: this.db.select().from(buddies).orderBy(buddies.createdAt).all(),
      trips: this.list(),
    };
  }

  importBackup(backup: Backup, mode: 'merge' | 'replace'): ImportResult {
    return this.db.transaction((tx) => {
      // Buddies first, so trips can point at them.
      const incomingBuddies = new Set(backup.buddies.map((b) => b.id));
      if (mode === 'replace') {
        for (const { id } of tx.select({ id: buddies.id }).from(buddies).all()) {
          if (!incomingBuddies.has(id)) tx.delete(buddies).where(eq(buddies.id, id)).run();
        }
      }
      // A buddy whose name is already taken by someone else is treated as that person.
      const sameAs = new Map<string, string>();
      for (const b of backup.buddies) {
        const byName = findBuddyByName(tx, b.name);
        if (byName && byName.id !== b.id) {
          sameAs.set(b.id, byName.id);
          continue;
        }
        const exists = tx.select({ id: buddies.id }).from(buddies).where(eq(buddies.id, b.id)).get();
        if (exists) tx.update(buddies).set(b).where(eq(buddies.id, b.id)).run();
        else tx.insert(buddies).values(b).run();
      }
      const known = new Set(
        tx
          .select({ id: buddies.id })
          .from(buddies)
          .all()
          .map((r) => r.id),
      );

      const existing = new Set(
        tx
          .select({ id: trips.id })
          .from(trips)
          .all()
          .map((r) => r.id),
      );
      const incoming = new Set(backup.trips.map((t) => t.id));
      let removed = 0;
      if (mode === 'replace') {
        for (const id of existing) {
          if (!incoming.has(id)) {
            tx.delete(trips).where(eq(trips.id, id)).run();
            removed++;
          }
        }
      }
      let added = 0;
      let updated = 0;
      for (const t of backup.trips) {
        const tripBuddies = [...new Set(t.buddies.map((b) => sameAs.get(b) ?? b))];
        if (tripBuddies.some((b) => !known.has(b)))
          throw new AppError(
            400,
            'invalid_backup',
            `“${t.title}” refers to a travel buddy that isn’t in the backup.`,
          );
        const row = { ...t, buddies: tripBuddies, deletedAt: null };
        if (existing.has(t.id)) {
          tx.update(trips).set(row).where(eq(trips.id, t.id)).run();
          updated++;
        } else {
          tx.insert(trips).values(row).run();
          added++;
        }
      }
      return { added, updated, removed };
    });
  }
}
