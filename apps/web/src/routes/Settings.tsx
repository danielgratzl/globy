import { backupSchema, type Buddy } from '@globy/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Monitor, Moon, Pencil, Sun, Trash2, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/AppShell';
import { BuddyAvatar } from '@/components/BuddyPicker';
import { ConfirmDialog } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { api } from '@/lib/api';
import { plural } from '@/lib/format';
import { useBuddies, useBuddyMutations, useTrips } from '@/lib/queries';
import { useTheme, type ThemePreference } from '@/lib/theme';

function AppearanceSection() {
  const { preference, setTheme } = useTheme();
  return (
    <section>
      <h2 className="text-[15px] font-semibold">Appearance</h2>
      <Segmented<ThemePreference>
        className="mt-3"
        value={preference}
        onChange={setTheme}
        options={[
          { value: 'system', label: 'System', icon: Monitor },
          { value: 'light', label: 'Light', icon: Sun },
          { value: 'dark', label: 'Dark', icon: Moon },
        ]}
      />
    </section>
  );
}

function DataSection() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<unknown>(null);
  const { data: trips = [] } = useTrips();

  const readFile = async (file: File) => {
    try {
      const data = backupSchema.safeParse(JSON.parse(await file.text()));
      if (!data.success) throw new Error();
      if (trips.length) setPending(data.data);
      else void runImport(data.data, 'merge');
    } catch {
      toast.error('That file isn’t a Globy backup', {
        description: 'Choose a JSON file exported from Globy.',
      });
    }
  };

  const runImport = async (backup: unknown, mode: 'merge' | 'replace') => {
    setBusy(true);
    try {
      const r = await api.importBackup({ mode, backup: backup as never });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['trips'] }),
        qc.invalidateQueries({ queryKey: ['buddies'] }),
      ]);
      toast.success(`Imported ${plural(r.added + r.updated, 'trip')}`, {
        description: [
          r.added && `${r.added} new`,
          r.updated && `${r.updated} updated`,
          r.removed && `${r.removed} removed`,
        ]
          .filter(Boolean)
          .join(', '),
      });
    } catch (e) {
      toast.error('Couldn’t import that file', { description: (e as Error).message });
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  return (
    <section>
      <h2 className="text-[15px] font-semibold">Your data</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Everything is stored on your server in a single SQLite file. A backup is one JSON file with all trips
        and travel buddies.
      </p>
      <div className="mt-4 divide-y rounded-xl border">
        <div className="flex items-center justify-between gap-4 p-4">
          <div>
            <div className="text-sm font-medium">Export trips</div>
            <div className="text-muted-foreground text-sm">
              Download all {plural(trips.length, 'trip')} as JSON.
            </div>
          </div>
          <Button variant="outline" size="sm" disabled={!trips.length} asChild={!!trips.length}>
            {trips.length ? (
              <a href="/api/export" download>
                <Download />
                Export
              </a>
            ) : (
              <span>
                <Download />
                Export
              </span>
            )}
          </Button>
        </div>
        <div className="flex items-center justify-between gap-4 p-4">
          <div>
            <div className="text-sm font-medium">Import trips</div>
            <div className="text-muted-foreground text-sm">Restore or merge a Globy backup.</div>
          </div>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Upload />
            {busy ? 'Importing…' : 'Import'}
          </Button>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void readFile(file);
          e.target.value = '';
        }}
      />
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title="Replace your trips?"
        description={`Replacing deletes the ${plural(trips.length, 'trip')} you have now that aren’t in the backup. Merging keeps them and adds or updates the ones from the file.`}
        confirmLabel="Replace all"
        secondaryLabel="Merge"
        onConfirm={() => void runImport(pending, 'replace')}
        onSecondary={() => void runImport(pending, 'merge')}
      />
    </section>
  );
}

function BuddyRow({ buddy, trips, onRemove }: { buddy: Buddy; trips: number; onRemove: () => void }) {
  const { rename } = useBuddyMutations();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(buddy.name);

  const save = () => {
    setEditing(false);
    const next = name.trim();
    if (!next || next === buddy.name) return setName(buddy.name);
    rename.mutate(
      { id: buddy.id, name: next },
      {
        onError: (e) => {
          setName(buddy.name);
          toast.error(`Couldn’t rename ${buddy.name}`, { description: e.message });
        },
      },
    );
  };

  return (
    <li className="group flex h-14 items-center gap-3 px-4">
      <BuddyAvatar name={editing ? name || buddy.name : buddy.name} className="size-8 text-xs" />
      {editing ? (
        <Input
          autoFocus
          value={name}
          maxLength={80}
          aria-label={`New name for ${buddy.name}`}
          className="h-8 flex-1"
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              save();
            } else if (e.key === 'Escape') {
              e.stopPropagation();
              setName(buddy.name);
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="hover:text-foreground flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium"
          aria-label={`Rename ${buddy.name}`}
        >
          <span className="truncate">{buddy.name}</span>
          <Pencil className="text-muted-foreground size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      )}
      <span className="text-muted-foreground tnum shrink-0 text-xs">{plural(trips, 'trip')}</span>
      <Button variant="quiet" size="icon-sm" aria-label={`Remove ${buddy.name}`} onClick={onRemove}>
        <Trash2 className="size-3.5" />
      </Button>
    </li>
  );
}

function BuddiesSection() {
  const { buddies, isPending } = useBuddies();
  const { data: trips = [] } = useTrips();
  const { remove } = useBuddyMutations();
  const [removing, setRemoving] = useState<Buddy | null>(null);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of trips) for (const b of t.buddies) m.set(b, (m.get(b) ?? 0) + 1);
    return m;
  }, [trips]);
  const removingTrips = removing ? (counts.get(removing.id) ?? 0) : 0;

  const confirmRemove = async (buddy: Buddy) => {
    try {
      const r = await remove.mutateAsync(buddy);
      toast.success(`Removed ${buddy.name}`, {
        description: r.removedFromTrips ? `Taken off ${plural(r.removedFromTrips, 'trip')}.` : undefined,
      });
    } catch (e) {
      toast.error(`Couldn’t remove ${buddy.name}`, { description: (e as Error).message });
    }
  };

  return (
    <section>
      <h2 className="text-[15px] font-semibold">Travel buddies</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        People you add to trips. Renaming someone updates every trip they’re on.
      </p>
      {isPending ? null : buddies.length === 0 ? (
        <p className="text-muted-foreground mt-4 rounded-xl border border-dashed p-4 text-sm">
          No one yet. Add travel buddies when you add or edit a trip.
        </p>
      ) : (
        <ul className="mt-4 divide-y rounded-xl border">
          {buddies.map((b) => (
            <BuddyRow key={b.id} buddy={b} trips={counts.get(b.id) ?? 0} onRemove={() => setRemoving(b)} />
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.name ?? ''}?`}
        description={
          removingTrips
            ? `They’ll be taken off ${plural(removingTrips, 'trip')}. The trips themselves stay.`
            : 'They aren’t on any trips.'
        }
        confirmLabel="Remove"
        onConfirm={() => removing && void confirmRemove(removing)}
      />
    </section>
  );
}

export function Settings() {
  return (
    <div className="anim-fade max-w-2xl">
      <PageHeader title="Settings" />
      <div className="space-y-10">
        <AppearanceSection />
        <BuddiesSection />
        <DataSection />
        <section>
          <h2 className="text-[15px] font-semibold">About</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Maps and regions from{' '}
            <a
              href="https://www.naturalearthdata.com/"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline-offset-4 hover:underline"
            >
              Natural Earth
            </a>
            , public domain. Country names in your browser’s language.
          </p>
        </section>
      </div>
    </div>
  );
}
