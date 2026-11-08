import type { Buddy } from '@globy/shared';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { Db } from '../db/client';
import { buddies, trips } from '../db/schema';
import { AppError, notFound } from '../lib/errors';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Conn = Db | Tx;

/** The buddy with this name, ignoring case. */
export function findBuddyByName(db: Conn, name: string): Buddy | undefined {
  return db
    .select()
    .from(buddies)
    .where(sql`${buddies.name} = ${name} COLLATE NOCASE`)
    .get();
}

/** Throws a field error unless every id is a known buddy. */
export function assertBuddiesExist(db: Conn, ids: readonly string[]): void {
  if (!ids.length) return;
  const found = db
    .select({ id: buddies.id })
    .from(buddies)
    .where(inArray(buddies.id, [...ids]))
    .all();
  if (found.length < new Set(ids).size)
    throw new AppError(400, 'invalid_request', 'Some fields need attention.', {
      buddies: 'Unknown travel buddy. Pick someone from the list.',
    });
}

const duplicate = (name: string) =>
  new AppError(409, 'conflict', `${name} is already on your list.`, {
    name: `${name} is already on your list.`,
  });

const isUniqueViolation = (e: unknown) =>
  e instanceof Error && 'code' in e && e.code === 'SQLITE_CONSTRAINT_UNIQUE';

export class BuddyService {
  constructor(private readonly db: Db) {}

  list(): Buddy[] {
    return this.db
      .select()
      .from(buddies)
      .orderBy(asc(sql`${buddies.name} COLLATE NOCASE`))
      .all();
  }

  get(id: string): Buddy {
    const row = this.db.select().from(buddies).where(eq(buddies.id, id)).get();
    if (!row) throw notFound('Travel buddy');
    return row;
  }

  create({ name }: { name: string }): Buddy {
    const existing = findBuddyByName(this.db, name);
    if (existing) throw duplicate(existing.name);
    const now = new Date().toISOString();
    const row = { id: randomUUID(), name, createdAt: now, updatedAt: now };
    try {
      this.db.insert(buddies).values(row).run();
    } catch (e) {
      if (isUniqueViolation(e)) throw duplicate(name);
      throw e;
    }
    return row;
  }

  rename(id: string, { name }: { name: string }): Buddy {
    this.get(id);
    const existing = findBuddyByName(this.db, name);
    if (existing && existing.id !== id) throw duplicate(existing.name);
    try {
      this.db
        .update(buddies)
        .set({ name, updatedAt: new Date().toISOString() })
        .where(eq(buddies.id, id))
        .run();
    } catch (e) {
      if (isUniqueViolation(e)) throw duplicate(name);
      throw e;
    }
    return this.get(id);
  }

  /**
   * Deletes the buddy and takes them off every trip, deleted trips included, so restoring a trip
   * never brings back someone who no longer exists. Returns the number of trips changed.
   */
  remove(id: string): number {
    this.get(id);
    return this.db.transaction((tx) => {
      const affected = tx
        .select({ id: trips.id, buddies: trips.buddies })
        .from(trips)
        .where(sql`EXISTS (SELECT 1 FROM json_each(${trips.buddies}) WHERE value = ${id})`)
        .all();
      for (const t of affected) {
        tx.update(trips)
          .set({ buddies: t.buddies.filter((b) => b !== id) })
          .where(eq(trips.id, t.id))
          .run();
      }
      tx.delete(buddies).where(eq(buddies.id, id)).run();
      return affected.length;
    });
  }
}
