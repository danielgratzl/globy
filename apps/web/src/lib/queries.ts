import {
  computeStats,
  todayIso,
  type Buddy,
  type Trip,
  type TripCreate,
  type TripPatch,
} from '@globy/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from './api';

const TRIPS = ['trips'] as const;
const BUDDIES = ['buddies'] as const;

export const useTrips = () => useQuery({ queryKey: TRIPS, queryFn: api.trips.list });

export function useStats() {
  const query = useTrips();
  const today = todayIso();
  const stats = useMemo(() => computeStats(query.data ?? [], today), [query.data, today]);
  return { ...query, stats };
}

const sortTrips = (trips: Trip[]) =>
  [...trips].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate));

export function useTripMutations() {
  const qc = useQueryClient();
  const setTrips = (fn: (trips: Trip[]) => Trip[]) =>
    qc.setQueryData<Trip[]>(TRIPS, (old) => sortTrips(fn(old ?? [])));
  const settle = () => qc.invalidateQueries({ queryKey: TRIPS });

  const create = useMutation({
    mutationFn: (input: TripCreate) => api.trips.create(input),
    onSuccess: (trip) => setTrips((t) => [...t, trip]),
    onSettled: settle,
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TripPatch }) => api.trips.update(id, patch),
    onSuccess: (trip) => setTrips((t) => t.map((x) => (x.id === trip.id ? trip : x))),
    onSettled: settle,
  });

  // Deleting is optimistic: the trip disappears at once and comes back if the request fails.
  const remove = useMutation({
    mutationFn: (trip: Trip) => api.trips.remove(trip.id),
    onMutate: async (trip) => {
      await qc.cancelQueries({ queryKey: TRIPS });
      const previous = qc.getQueryData<Trip[]>(TRIPS);
      setTrips((t) => t.filter((x) => x.id !== trip.id));
      return { previous };
    },
    onError: (_e, _trip, ctx) => ctx?.previous && qc.setQueryData(TRIPS, ctx.previous),
    onSettled: settle,
  });

  const restore = useMutation({
    mutationFn: (trip: Trip) => api.trips.restore(trip.id),
    onMutate: (trip) => setTrips((t) => (t.some((x) => x.id === trip.id) ? t : [...t, trip])),
    onSettled: settle,
  });

  return { create, update, remove, restore };
}

const byName = (a: Buddy, b: Buddy) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/** Travel buddies sorted by name, plus a lookup by id. */
export function useBuddies() {
  const query = useQuery({ queryKey: BUDDIES, queryFn: api.buddies.list });
  const byId = useMemo(() => new Map((query.data ?? []).map((b) => [b.id, b])), [query.data]);
  return { ...query, buddies: query.data ?? [], byId };
}

export function useBuddyMutations() {
  const qc = useQueryClient();
  const setBuddies = (fn: (b: Buddy[]) => Buddy[]) =>
    qc.setQueryData<Buddy[]>(BUDDIES, (old) => fn(old ?? []).sort(byName));
  const settle = () => qc.invalidateQueries({ queryKey: BUDDIES });

  const create = useMutation({
    mutationFn: (name: string) => api.buddies.create({ name }),
    onSuccess: (buddy) => setBuddies((b) => [...b.filter((x) => x.id !== buddy.id), buddy]),
    onSettled: settle,
  });

  // Renaming is optimistic; every trip shows the new name at once.
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.buddies.rename(id, name),
    onMutate: async ({ id, name }) => {
      await qc.cancelQueries({ queryKey: BUDDIES });
      const previous = qc.getQueryData<Buddy[]>(BUDDIES);
      setBuddies((b) => b.map((x) => (x.id === id ? { ...x, name } : x)));
      return { previous };
    },
    onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(BUDDIES, ctx.previous),
    onSettled: settle,
  });

  const remove = useMutation({
    mutationFn: (buddy: Buddy) => api.buddies.remove(buddy.id),
    onSuccess: (_r, buddy) => {
      setBuddies((b) => b.filter((x) => x.id !== buddy.id));
      qc.setQueryData<Trip[]>(TRIPS, (old) =>
        old?.map((t) =>
          t.buddies.includes(buddy.id) ? { ...t, buddies: t.buddies.filter((id) => id !== buddy.id) } : t,
        ),
      );
    },
    onSettled: () => Promise.all([settle(), qc.invalidateQueries({ queryKey: TRIPS })]),
  });

  return { create, rename, remove };
}
