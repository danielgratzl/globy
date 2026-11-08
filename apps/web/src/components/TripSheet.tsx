import { regionsOf, type Trip, type TripCreate } from '@globy/shared';
import { Loader2, Trash2 } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BuddyPicker } from '@/components/BuddyPicker';
import { CountryPicker } from '@/components/CountryPicker';
import { DateRangePicker } from '@/components/DateRangePicker';
import { RegionPicker } from '@/components/RegionPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { ApiRequestError } from '@/lib/api';
import { countryName } from '@/lib/format';
import { useHighlight } from '@/lib/highlight';
import { useStats, useTripMutations } from '@/lib/queries';
import { useSheet } from '@/lib/sheet';
import { useDeleteTrip } from '@/lib/use-delete-trip';
import { cn } from '@/lib/utils';

interface FormState {
  title: string;
  startDate: string;
  endDate: string;
  country: string;
  regions: string[];
  buddies: string[];
  notes: string;
}

const empty = (country = ''): FormState => ({
  title: '',
  startDate: '',
  endDate: '',
  country,
  regions: [],
  buddies: [],
  notes: '',
});

const fromTrip = (t: Trip): FormState => ({ ...t, notes: t.notes ?? '' });

function clientErrors(f: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.title.trim()) e.title = 'Give the trip a title.';
  if (!f.startDate) e.startDate = 'Pick the dates of the trip.';
  if (!f.country) e.country = 'Pick a country.';
  return e;
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
      </div>
      {/* The shake runs when the error class is added; no remount, so open popovers stay open. */}
      <div className={cn(error && 'anim-shake')}>{children}</div>
      {error && <p className="anim-fade text-destructive text-xs">{error}</p>}
    </div>
  );
}

function TripForm({
  trip,
  initialCountry,
  onDone,
}: {
  trip?: Trip;
  initialCountry?: string;
  onDone: () => void;
}) {
  const id = useId();
  const { stats } = useStats();
  const { create, update } = useTripMutations();
  const deleteTrip = useDeleteTrip();
  const { flash } = useHighlight();
  const [form, setForm] = useState<FormState>(() => (trip ? fromTrip(trip) : empty(initialCountry)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const saving = create.isPending || update.isPending;
  const visited = useMemo(() => stats.byCountry.slice(0, 6).map((c) => c.country), [stats.byCountry]);
  const hasRegions = regionsOf(form.country).length > 1;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors(({ [key]: _gone, ...rest }) => rest);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = clientErrors(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    const input: TripCreate = {
      title: form.title.trim(),
      startDate: form.startDate,
      endDate: form.endDate || form.startDate,
      country: form.country,
      regions: hasRegions ? form.regions : [],
      buddies: form.buddies,
      notes: form.notes.trim() || null,
    };
    const onError = (err: Error) => {
      if (err instanceof ApiRequestError && Object.keys(err.fields).length) setErrors(err.fields);
      else toast.error('Couldn’t save the trip', { description: err.message });
    };
    if (trip) {
      update.mutate(
        { id: trip.id, patch: input },
        {
          onSuccess: (saved) => {
            flash(saved.id);
            toast.success('Trip updated');
            onDone();
          },
          onError,
        },
      );
    } else {
      create.mutate(input, {
        onSuccess: (saved) => {
          flash(saved.id);
          toast.success(`Added “${saved.title}”`, { description: countryName(saved.country) });
          onDone();
        },
        onError,
      });
    }
  };

  // Suggest a title from the country while it's still empty.
  const titlePlaceholder = form.country
    ? `e.g. Summer in ${countryName(form.country)}`
    : 'e.g. Summer road trip';

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-6">
        <Field label="Country" htmlFor={`${id}-country`} error={errors.country}>
          <CountryPicker
            id={`${id}-country`}
            value={form.country}
            recent={visited}
            invalid={!!errors.country}
            onChange={(c) => {
              if (c !== form.country) set('regions', []);
              set('country', c);
            }}
          />
        </Field>
        <Field label="Title" htmlFor={`${id}-title`} error={errors.title}>
          <Input
            id={`${id}-title`}
            value={form.title}
            placeholder={titlePlaceholder}
            maxLength={200}
            autoComplete="off"
            aria-invalid={!!errors.title || undefined}
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>
        <Field label="Dates" htmlFor={`${id}-dates`} error={errors.startDate ?? errors.endDate}>
          <DateRangePicker
            id={`${id}-dates`}
            start={form.startDate}
            end={form.endDate}
            invalid={!!(errors.startDate ?? errors.endDate)}
            onChange={(s, e) => {
              setForm((f) => ({ ...f, startDate: s, endDate: e }));
              setErrors(({ startDate: _s, endDate: _e, ...rest }) => rest);
            }}
          />
        </Field>
        <Field label="Travel buddies" htmlFor={`${id}-buddies`} error={errors.buddies} hint="Optional">
          <BuddyPicker id={`${id}-buddies`} value={form.buddies} onChange={(b) => set('buddies', b)} />
        </Field>
        {form.country && hasRegions && (
          <div className="anim-fade">
            <Field label="Regions visited" error={errors.regions} hint="Optional">
              <RegionPicker
                key={form.country}
                country={form.country}
                value={form.regions}
                onChange={(r) => set('regions', r)}
              />
            </Field>
          </div>
        )}
        <Field label="Notes" htmlFor={`${id}-notes`} hint="Optional">
          <Textarea
            id={`${id}-notes`}
            value={form.notes}
            rows={3}
            placeholder="Highlights, people, places to go back to…"
            onChange={(e) => set('notes', e.target.value)}
          />
        </Field>
      </div>
      <div className="flex items-center gap-2 border-t px-5 py-3 sm:px-6">
        {trip && (
          <Button
            variant="quiet"
            onClick={() => {
              deleteTrip(trip);
              onDone();
            }}
          >
            <Trash2 />
            Delete
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {trip ? 'Save changes' : 'Add trip'}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function TripSheet() {
  const sheet = useSheet();
  const { data: trips, isPending } = useStats();
  const state = sheet.state;
  const trip = state?.mode === 'edit' ? trips?.find((t) => t.id === state.id) : undefined;
  const missing = state?.mode === 'edit' && !isPending && !trip;

  const { close } = sheet;
  useEffect(() => {
    if (!missing) return;
    toast.error('That trip doesn’t exist anymore');
    close();
    // Only react to the trip going missing, not to a new close function every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing]);

  const open = !!state && (state.mode === 'add' || !!trip);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && sheet.close()}>
      <SheetContent className="sm:max-w-[520px]">
        <SheetHeader title={trip ? 'Edit trip' : 'New trip'} />
        {open && (
          <TripForm
            key={trip?.id ?? 'new'}
            trip={trip}
            initialCountry={state?.mode === 'add' ? state.country : undefined}
            onDone={sheet.close}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
