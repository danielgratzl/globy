import type { Buddy } from '@globy/shared';
import { Check, Loader2, Plus, UserPlus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { fold } from '@/lib/format';
import { useBuddies, useBuddyMutations, useStats } from '@/lib/queries';
import { cn } from '@/lib/utils';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = Array.from(parts[0] ?? '?')[0] ?? '?';
  const last = parts.length > 1 ? (Array.from(parts.at(-1)!)[0] ?? '') : '';
  return (first + last).toLocaleUpperCase();
}

export function BuddyAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'bg-primary/10 text-primary grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

const sameName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;

/** Pick travel buddies from everyone added before, or add someone new by typing their name. */
export function BuddyPicker({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string[];
  onChange: (buddies: string[]) => void;
}) {
  const { buddies, byId } = useBuddies();
  const { stats } = useStats();
  const { create } = useBuddyMutations();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = useMemo(() => new Set(value), [value]);

  // People you travel with most come first.
  const sorted = useMemo(() => {
    const rank = new Map(stats.byBuddy.map((b, i) => [b.buddy, i]));
    return [...buddies].sort(
      (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) || a.name.localeCompare(b.name),
    );
  }, [buddies, stats.byBuddy]);

  const name = search.trim();
  const exact = name ? buddies.find((b) => sameName(b.name, name)) : undefined;
  const shown = name ? sorted.filter((b) => fold(b.name).includes(fold(name))) : sorted;

  const toggle = (buddyId: string) => {
    onChange(selected.has(buddyId) ? value.filter((v) => v !== buddyId) : [...value, buddyId]);
    setSearch('');
  };

  const addNew = async () => {
    if (!name || create.isPending) return;
    try {
      const buddy = await create.mutateAsync(name);
      onChange([...value, buddy.id]);
      setSearch('');
    } catch (err) {
      toast.error(`Couldn’t add ${name}`, { description: (err as Error).message });
    }
  };

  const chips = value.map((v) => byId.get(v)).filter((b): b is Buddy => !!b);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((b) => (
        <span
          key={b.id}
          className="anim-pop bg-secondary text-secondary-foreground inline-flex h-7 items-center gap-1.5 rounded-full pl-1 pr-1 text-[13px]"
        >
          <BuddyAvatar name={b.name} />
          {b.name}
          <button
            type="button"
            onClick={() => toggle(b.id)}
            aria-label={`Remove ${b.name}`}
            className="text-muted-foreground hover:bg-background hover:text-foreground grid size-5 place-items-center rounded-full transition-colors"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setSearch('');
        }}
      >
        <PopoverTrigger asChild>
          <Button id={id} variant="outline" size="sm" className="h-7 rounded-full">
            {chips.length ? <Plus /> : <UserPlus />}
            {chips.length ? 'Add' : 'Add travel buddies'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          {/* Filtering by plain substring is more predictable for names than cmdk's fuzzy match. */}
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder={buddies.length ? 'Search or add someone…' : 'Type a name…'}
            />
            <CommandList>
              {!name && !buddies.length && (
                <p className="text-muted-foreground px-3 py-6 text-center text-sm">
                  Type the name of someone you traveled with.
                </p>
              )}
              {buddies.length > 0 && <CommandEmpty>No one found.</CommandEmpty>}
              {shown.length > 0 && (
                <CommandGroup heading="Travel buddies">
                  {shown.map((b) => (
                    <CommandItem key={b.id} value={b.id} onSelect={() => toggle(b.id)}>
                      <BuddyAvatar name={b.name} />
                      <span className="truncate">{b.name}</span>
                      <Check
                        className={cn(
                          'ml-auto transition-opacity',
                          selected.has(b.id) ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {/* After the matches, so Enter on a partial name picks the existing person. */}
              {name && !exact && (
                <CommandGroup>
                  <CommandItem value="__add__" onSelect={addNew}>
                    {create.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}
                    <span className="truncate">
                      Add <span className="font-medium">“{name}”</span>
                    </span>
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
