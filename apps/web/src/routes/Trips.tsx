import { flagOf, todayIso, type Buddy, type Trip } from '@globy/shared';
import { Luggage, Plus, Search, Trash2, X } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { PageHeader } from '@/components/AppShell';
import { BuddyAvatar } from '@/components/BuddyPicker';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { countryName, durationText, fold, formatRange, nameList, plural, regionName } from '@/lib/format';
import { useHighlight } from '@/lib/highlight';
import { useBuddies, useTrips } from '@/lib/queries';
import { useSheet } from '@/lib/sheet';
import { useDeleteTrip } from '@/lib/use-delete-trip';
import { cn } from '@/lib/utils';

type Buddies = Map<string, Buddy>;

const buddyNames = (t: Trip, buddies: Buddies) =>
  t.buddies.map((id) => buddies.get(id)?.name).filter((n): n is string => !!n);

function matches(t: Trip, q: string, buddies: Buddies) {
  if (!q) return true;
  const hay = fold(
    [
      t.title,
      t.notes ?? '',
      countryName(t.country),
      t.country,
      ...t.regions.map((r) => regionName(t.country, r)),
      ...buddyNames(t, buddies),
    ].join(' '),
  );
  return fold(q)
    .split(/\s+/)
    .every((w) => hay.includes(w));
}

function TripRow({ trip, today, buddies }: { trip: Trip; today: string; buddies: Buddies }) {
  const sheet = useSheet();
  const del = useDeleteTrip();
  const { id: highlight } = useHighlight();
  const upcoming = trip.startDate > today;
  const now = !upcoming && trip.endDate >= today;
  const withNames = buddyNames(trip, buddies);
  return (
    <li className={cn('group relative', highlight === trip.id && 'just-added')}>
      <button
        type="button"
        onClick={() => sheet.edit(trip.id)}
        className="hover:bg-accent/50 flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors"
      >
        <span className="ease-snappy mt-0.5 text-2xl leading-none transition-transform duration-300 group-hover:scale-110">
          {flagOf(trip.country)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium">{trip.title}</span>
            {upcoming && <Badge variant="outline">Planned</Badge>}
            {now && <Badge>Now</Badge>}
          </span>
          <span className="text-muted-foreground block text-[13px]">
            {countryName(trip.country)} · {formatRange(trip.startDate, trip.endDate)} · {durationText(trip)}
            {withNames.length > 0 && ` · with ${nameList(withNames)}`}
          </span>
          {trip.regions.length > 0 && (
            <span className="mt-1.5 flex flex-wrap gap-1">
              {trip.regions.map((r) => (
                <span
                  key={r}
                  className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs"
                >
                  {regionName(trip.country, r)}
                </span>
              ))}
            </span>
          )}
        </span>
      </button>
      <Button
        variant="quiet"
        size="icon-sm"
        aria-label={`Delete ${trip.title}`}
        className="absolute right-2 top-2.5 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
        onClick={() => del(trip)}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </li>
  );
}

export function Trips() {
  const { data: trips = [], isPending } = useTrips();
  const sheet = useSheet();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const q = useDeferredValue(query.trim());
  const { byId: buddies, isPending: buddiesPending } = useBuddies();
  const country = params.get('country');
  // An unknown buddy id (say, someone since removed) just shows every trip.
  const buddyParam = params.get('buddy');
  const buddyFilter = buddyParam ? buddies.get(buddyParam) : undefined;
  const buddyId = buddyParam && (buddiesPending || buddyFilter) ? buddyParam : null;
  const today = todayIso();

  const groups = useMemo(() => {
    const list = trips.filter(
      (t) =>
        (!country || t.country === country) &&
        (!buddyId || t.buddies.includes(buddyId)) &&
        matches(t, q, buddies),
    );
    const byYear = new Map<string, Trip[]>();
    for (const t of [...list].reverse()) {
      const key = t.startDate > today ? 'Planned' : t.startDate.slice(0, 4);
      byYear.set(key, [...(byYear.get(key) ?? []), t]);
    }
    // Planned trips first, soonest at the top.
    const planned = byYear.get('Planned');
    if (planned) planned.reverse();
    return [...byYear.entries()].sort(([a], [b]) =>
      a === 'Planned' ? -1 : b === 'Planned' ? 1 : b.localeCompare(a),
    );
  }, [trips, country, buddyId, q, today, buddies]);
  const shown = groups.reduce((n, [, l]) => n + l.length, 0);

  const clearFilter = (key: 'country' | 'buddy') => {
    const p = new URLSearchParams(params);
    p.delete(key);
    setParams(p);
  };

  if (isPending)
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    );

  if (!trips.length)
    return (
      <EmptyState
        icon={Luggage}
        title="No trips yet"
        actions={
          <Button onClick={() => sheet.add()}>
            <Plus />
            Add a trip
          </Button>
        }
      >
        Every trip you add shows up here, grouped by year.
      </EmptyState>
    );

  return (
    <div className="anim-fade max-w-3xl">
      <PageHeader
        title="Trips"
        subtitle={
          shown === trips.length
            ? plural(trips.length, 'trip')
            : `${shown} of ${plural(trips.length, 'trip')}`
        }
        actions={
          <Button onClick={() => sheet.add(country ?? undefined)} className="hidden sm:inline-flex">
            <Plus />
            Add trip
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            data-search
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search trips, places, people…"
            className="pl-9"
            aria-label="Search trips"
          />
        </div>
        {country && (
          <Button
            variant="secondary"
            size="sm"
            className="anim-pop h-9 rounded-full"
            onClick={() => clearFilter('country')}
          >
            {flagOf(country)} {countryName(country)}
            <X />
          </Button>
        )}
        {buddyFilter && (
          <Button
            variant="secondary"
            size="sm"
            className="anim-pop h-9 rounded-full pl-1.5"
            onClick={() => clearFilter('buddy')}
          >
            <BuddyAvatar name={buddyFilter.name} className="size-6" />
            {buddyFilter.name}
            <X />
          </Button>
        )}
      </div>
      {groups.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">No trips match your search.</p>
      ) : (
        <div className="space-y-8">
          {groups.map(([year, list]) => (
            <section key={year} className="anim-fade">
              <h2 className="bg-background/90 sticky top-0 z-[1] flex items-baseline gap-2 py-2 text-[15px] font-semibold backdrop-blur">
                {year}
                <span className="text-muted-foreground tnum text-xs font-normal">
                  {plural(list.length, 'trip')} ·{' '}
                  {plural(new Set(list.map((t) => t.country)).size, 'country', 'countries')}
                </span>
              </h2>
              <ul className="-mx-3">
                {list.map((t) => (
                  <TripRow key={t.id} trip={t} today={today} buddies={buddies} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
