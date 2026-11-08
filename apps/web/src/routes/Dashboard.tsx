import { daysInclusive, flagOf, todayIso, type BuddyVisit, type Trip } from '@globy/shared';
import { CalendarClock, ChevronRight, Hourglass, Plane, Plus, Sparkles, type LucideIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { PageHeader } from '@/components/AppShell';
import { BuddyAvatar } from '@/components/BuddyPicker';
import { WorldMap, type CountryVisitInfo } from '@/components/WorldMap';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { useCountUp } from '@/lib/count-up';
import { countryName, durationText, formatRange, plural, regionName, untilText } from '@/lib/format';
import { LEVEL_LEGEND } from '@/lib/map';
import { useBuddies, useStats } from '@/lib/queries';
import { useSheet } from '@/lib/sheet';
import { cn } from '@/lib/utils';

function StatTile({
  label,
  value,
  suffix,
  detail,
  delay = 0,
  className,
}: {
  label: string;
  value: number;
  suffix?: string;
  detail?: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const shown = useCountUp(value);
  return (
    <div
      className={cn('bg-card anim-rise rounded-xl border p-4', className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="tnum text-2xl font-semibold tracking-tight sm:text-3xl">
          {Math.round(shown).toLocaleString()}
        </span>
        {suffix && <span className="text-muted-foreground text-sm">{suffix}</span>}
      </div>
      {detail && <div className="text-muted-foreground mt-1 truncate text-xs">{detail}</div>}
    </div>
  );
}

function Legend() {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
      <span className="flex items-center gap-1.5">
        {LEVEL_LEGEND.map((l) => (
          <span key={l.level} className="flex items-center gap-1">
            <span className="map-swatch" data-level={l.level} />
            {l.label}
          </span>
        ))}
        <span className="ml-0.5">trips</span>
      </span>
      <span className="flex items-center gap-1">
        <span className="map-swatch" data-upcoming />
        Planned
      </span>
      <span className="hidden sm:inline">Click a country to see its regions.</span>
    </div>
  );
}

const chartConfig = {
  trips: { label: 'Trips', color: 'var(--chart-seq)' },
  days: { label: 'Days', color: 'var(--chart-seq)' },
  newCountries: { label: 'New countries', color: 'var(--chart-seq)' },
} satisfies ChartConfig;
type Metric = keyof typeof chartConfig;

function YearChart({
  data,
}: {
  data: { year: number; trips: number; days: number; newCountries: number }[];
}) {
  const [metric, setMetric] = useState<Metric>('trips');
  return (
    <section className="bg-card rounded-xl border p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold">By year</h2>
        <Segmented<Metric>
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'trips', label: 'Trips' },
            { value: 'days', label: 'Days' },
            { value: 'newCountries', label: 'New countries' },
          ]}
        />
      </div>
      <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
        <BarChart data={data} margin={{ left: -20, right: 4, top: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="year" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={44} />
          <ChartTooltip
            cursor={{ fill: 'var(--muted)', radius: 4 }}
            content={<ChartTooltipContent hideIndicator />}
          />
          <Bar
            key={metric}
            dataKey={metric}
            fill={`var(--color-${metric})`}
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
            animationDuration={600}
          />
        </BarChart>
      </ChartContainer>
    </section>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex min-h-8 items-center justify-between">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {action}
    </div>
  );
}

function TravelBuddies({
  visits,
  trips,
  soloTrips,
}: {
  visits: BuddyVisit[];
  trips: number;
  soloTrips: number;
}) {
  const { byId, isPending } = useBuddies();
  const rows = visits.filter((v) => byId.has(v.buddy)).slice(0, 6);
  const max = Math.max(1, ...rows.map((r) => r.trips));
  const together = Math.round(((trips - soloTrips) / Math.max(1, trips)) * 100);
  return (
    <section>
      <SectionHeader
        title="Travel buddies"
        action={
          rows.length > 0 && (
            <span className="text-muted-foreground tnum text-xs">
              {plural(visits.length, 'person', 'people')} · {together}% of trips together
            </span>
          )
        }
      />
      {isPending ? (
        <Skeleton className="h-24 rounded-lg" />
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Add who you traveled with to a trip to see your favorite travel companions here.
        </p>
      ) : (
        <ul className="space-y-1">
          {rows.map((v, i) => {
            const name = byId.get(v.buddy)!.name;
            return (
              <li key={v.buddy}>
                <Link
                  to={`/trips?buddy=${v.buddy}`}
                  className="hover:bg-accent/50 group grid grid-cols-[minmax(0,190px)_1fr_auto] items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <BuddyAvatar
                      name={name}
                      className="ease-snappy size-7 text-[11px] transition-transform duration-300 group-hover:scale-110"
                    />
                    <span className="min-w-0">
                      <span className="block truncate">{name}</span>
                      <span className="text-muted-foreground tnum block truncate text-xs">
                        {plural(v.countries.length, 'country', 'countries')} · {plural(v.days, 'day')}
                      </span>
                    </span>
                  </span>
                  <span className="bg-muted h-1.5 overflow-hidden rounded-full">
                    <span
                      className="anim-grow bg-(--chart-seq) block h-full origin-left rounded-full"
                      style={{ width: `${(v.trips / max) * 100}%`, animationDelay: `${i * 60}ms` }}
                    />
                  </span>
                  <span className="text-muted-foreground tnum text-right text-xs">
                    {plural(v.trips, 'trip')}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Highlight({
  icon: Icon,
  label,
  trip,
  meta,
}: {
  icon: LucideIcon;
  label: string;
  trip: Trip | undefined;
  meta?: string;
}) {
  const sheet = useSheet();
  if (!trip) return null;
  return (
    <button
      type="button"
      onClick={() => sheet.edit(trip.id)}
      className="hover:bg-accent/50 group flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors"
    >
      <span className="bg-muted text-muted-foreground group-hover:text-foreground grid size-9 shrink-0 place-items-center rounded-full transition-colors">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-muted-foreground block text-xs">{label}</span>
        <span className="block truncate text-sm font-medium">
          {flagOf(trip.country)} {trip.title}
        </span>
      </span>
      <span className="text-muted-foreground tnum shrink-0 text-xs">{meta}</span>
    </button>
  );
}

function EmptyDashboard() {
  const sheet = useSheet();
  return (
    <div className="anim-fade mx-auto mt-8 max-w-md text-center">
      <img src="/globy-logo.svg" alt="" className="anim-float mx-auto mb-6 size-20" />
      <h1 className="text-xl font-semibold tracking-tight">Where have you been?</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Add your first trip: a country, the dates, and if you like the states or regions you visited. Your map
        and stats fill in as you go.
      </p>
      <Button className="mt-6" onClick={() => sheet.add()}>
        <Plus />
        Add a trip
      </Button>
    </div>
  );
}

export function Dashboard() {
  const { stats, isPending, data: trips = [] } = useStats();
  const sheet = useSheet();
  const [focus, setFocus] = useState<string | null>(null);
  const today = todayIso();

  const visits = useMemo(() => {
    const m = new Map<string, CountryVisitInfo>();
    for (const c of stats.byCountry) m.set(c.country, { trips: c.trips, regions: new Map() });
    for (const t of stats.past) {
      const regions = m.get(t.country)!.regions!;
      for (const r of t.regions) regions.set(r, (regions.get(r) ?? 0) + 1);
    }
    for (const t of stats.upcoming) if (!m.has(t.country)) m.set(t.country, { trips: 0, upcoming: true });
    return m;
  }, [stats]);

  const byCountry = useMemo(() => new Map(stats.byCountry.map((c) => [c.country, c])), [stats.byCountry]);

  const tooltip = useCallback(
    (country: string, region?: { properties: { code: string; name: string } }) => {
      const v = byCountry.get(country);
      const planned = stats.upcoming.filter((t) => t.country === country).length;
      if (region) {
        const n = visits.get(country)?.regions?.get(region.properties.code) ?? 0;
        return (
          <>
            <div className="font-medium">{region.properties.name}</div>
            <div className="text-muted-foreground">{n ? plural(n, 'trip') : 'Not visited yet'}</div>
          </>
        );
      }
      return (
        <>
          <div className="font-medium">
            {flagOf(country)} {countryName(country)}
          </div>
          <div className="text-muted-foreground">
            {v
              ? `${plural(v.trips, 'trip')} · ${plural(v.days, 'day')}`
              : planned
                ? 'Planned'
                : 'Not visited yet'}
          </div>
          {v && v.regionTotal > 1 && (
            <div className="text-muted-foreground tnum">
              {v.regions.length} of {v.regionTotal} regions
            </div>
          )}
        </>
      );
    },
    [byCountry, stats.upcoming, visits],
  );

  if (isPending)
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="aspect-[2/1] w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );

  if (!trips.length) return <EmptyDashboard />;

  const focusVisit = focus ? byCountry.get(focus) : undefined;
  const coverage = stats.byCountry
    .filter((c) => c.regionTotal > 1 && c.regions.length > 0)
    .sort((a, b) => b.regions.length / b.regionTotal - a.regions.length / a.regionTotal)
    .slice(0, 6);
  const topMax = Math.max(1, ...stats.byCountry.map((c) => c.trips));
  const current = stats.current[0];
  const next = stats.upcoming[0];
  const recent = [...stats.past].reverse().slice(0, 5);
  const firstYear = stats.first ? Number(stats.first.startDate.slice(0, 4)) : undefined;

  return (
    <div className="anim-fade">
      <PageHeader
        title="Your travels"
        subtitle={
          firstYear
            ? `${plural(stats.trips, 'trip')} since ${firstYear}`
            : stats.upcoming.length
              ? `${plural(stats.upcoming.length, 'trip')} planned`
              : undefined
        }
        actions={
          <Button onClick={() => sheet.add()} className="hidden sm:inline-flex md:hidden">
            <Plus />
            Add trip
          </Button>
        }
      />

      <section className="bg-card overflow-hidden rounded-xl border">
        <WorldMap
          visits={visits}
          focus={focus}
          onFocusChange={setFocus}
          renderTooltip={tooltip}
          overlay={
            focus && (
              <div className="bg-background/90 anim-rise w-60 rounded-lg border p-3 shadow-sm backdrop-blur">
                <div className="flex items-center gap-2 font-medium">
                  <span className="text-lg leading-none">{flagOf(focus)}</span>
                  <span className="truncate">{countryName(focus)}</span>
                </div>
                <div className="text-muted-foreground tnum mt-1 text-xs">
                  {focusVisit
                    ? `${plural(focusVisit.trips, 'trip')} · ${plural(focusVisit.days, 'day')}`
                    : 'Not visited yet'}
                </div>
                {focusVisit && focusVisit.regionTotal > 1 && (
                  <div className="mt-2">
                    <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                      <div
                        className="bg-(--chart-seq) h-full rounded-full transition-[width] duration-700"
                        style={{ width: `${(focusVisit.regions.length / focusVisit.regionTotal) * 100}%` }}
                      />
                    </div>
                    <div className="text-muted-foreground tnum mt-1 text-xs">
                      {focusVisit.regions.length} of {focusVisit.regionTotal} regions
                    </div>
                  </div>
                )}
                <div className="mt-2.5 flex gap-1.5">
                  <Button size="sm" className="h-7" onClick={() => sheet.add(focus)}>
                    <Plus />
                    Trip
                  </Button>
                  {focusVisit && (
                    <Button size="sm" variant="ghost" className="h-7" asChild>
                      <Link to={`/trips?country=${focus}`}>
                        View trips
                        <ChevronRight />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            )
          }
        />
        <div className="border-t px-4 py-2.5">
          <Legend />
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          label="Countries"
          value={stats.countries}
          detail={`${Math.round(stats.worldShare * 100)}% of the world`}
        />
        <StatTile
          label="Trips"
          value={stats.trips}
          delay={50}
          detail={stats.upcoming.length ? `${stats.upcoming.length} planned` : undefined}
        />
        <StatTile
          label="Days traveling"
          value={stats.days}
          delay={100}
          detail={stats.trips ? `${Math.round(stats.days / stats.trips)} per trip on average` : undefined}
        />
        <StatTile label="Regions" value={stats.regions} delay={150} detail="states, provinces, …" />
        <StatTile
          label="Continents"
          value={stats.continents.length}
          suffix="/ 7"
          delay={200}
          className="col-span-2 lg:col-span-1"
          detail={stats.continents.join(', ')}
        />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[3fr_2fr]">
        <YearChart data={stats.byYear} />
        <section>
          <SectionHeader title="Highlights" />
          <div className="space-y-1">
            {current && (
              <Highlight
                icon={Plane}
                label="Traveling now"
                trip={current}
                meta={`day ${daysInclusive(current.startDate, today)} of ${daysInclusive(current.startDate, current.endDate)}`}
              />
            )}
            <Highlight
              icon={CalendarClock}
              label="Next up"
              trip={next}
              meta={next && untilText(next.startDate, today)}
            />
            <Highlight
              icon={Hourglass}
              label="Longest trip"
              trip={stats.longest}
              meta={stats.longest && durationText(stats.longest)}
            />
            <Highlight
              icon={Sparkles}
              label="First trip"
              trip={stats.first}
              meta={stats.first?.startDate.slice(0, 4)}
            />
          </div>
        </section>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <SectionHeader
            title="Most visited"
            action={
              <Button variant="ghost" size="sm" className="-mr-2" asChild>
                <Link to="/trips">All trips</Link>
              </Button>
            }
          />
          <ul className="space-y-1">
            {stats.byCountry.slice(0, 6).map((c, i) => (
              <li key={c.country}>
                <button
                  type="button"
                  onClick={() => {
                    setFocus(c.country);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="hover:bg-accent/50 grid w-full grid-cols-[minmax(0,150px)_1fr_auto] items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors"
                >
                  <span className="truncate">
                    {flagOf(c.country)} {countryName(c.country)}
                  </span>
                  <span className="bg-muted h-1.5 overflow-hidden rounded-full">
                    <span
                      className="anim-grow bg-(--chart-seq) block h-full origin-left rounded-full"
                      style={{ width: `${(c.trips / topMax) * 100}%`, animationDelay: `${i * 60}ms` }}
                    />
                  </span>
                  <span className="text-muted-foreground tnum text-right text-xs">
                    {plural(c.trips, 'trip')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <SectionHeader title="Region coverage" />
          {coverage.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Add the states or regions you visited to a trip to see how much of each country you’ve explored.
            </p>
          ) : (
            <ul className="space-y-3">
              {coverage.map((c, i) => (
                <li key={c.country} className="text-sm">
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="truncate">
                      {flagOf(c.country)} {countryName(c.country)}
                    </span>
                    <span className="text-muted-foreground tnum text-xs">
                      {c.regions.length} / {c.regionTotal}
                    </span>
                  </div>
                  <div
                    className="bg-muted h-1.5 overflow-hidden rounded-full"
                    title={c.regions.map((r) => regionName(c.country, r)).join(', ')}
                  >
                    <div
                      className="anim-grow bg-(--chart-seq) h-full origin-left rounded-full"
                      style={{
                        width: `${(c.regions.length / c.regionTotal) * 100}%`,
                        animationDelay: `${i * 60}ms`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <SectionHeader
            title="Recent trips"
            action={
              <Button variant="ghost" size="sm" className="-mr-2" asChild>
                <Link to="/trips">
                  All {stats.trips + stats.upcoming.length}
                  <ChevronRight />
                </Link>
              </Button>
            }
          />
          <ul className="divide-y rounded-xl border">
            {recent.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => sheet.edit(t.id)}
                  className="hover:bg-accent/50 flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors first:rounded-t-xl last:rounded-b-xl"
                >
                  <span className="text-xl leading-none">{flagOf(t.country)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{t.title}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {countryName(t.country)}
                      {t.regions.length > 0 &&
                        ` · ${t.regions.map((r) => regionName(t.country, r)).join(', ')}`}
                    </span>
                  </span>
                  <span className={cn('text-muted-foreground tnum hidden shrink-0 text-xs sm:block')}>
                    {formatRange(t.startDate, t.endDate)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <TravelBuddies visits={stats.byBuddy} trips={stats.trips} soloTrips={stats.soloTrips} />
      </div>
    </div>
  );
}
