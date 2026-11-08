import { regionsOf } from '@globy/shared';
import { Check, Map as MapIcon, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CountryMap } from '@/components/CountryMap';
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
import { regionName } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Pick visited regions from a searchable list or by clicking them on a map. */
export function RegionPicker({
  country,
  value,
  onChange,
}: {
  country: string;
  value: string[];
  onChange: (regions: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const regions = useMemo(() => regionsOf(country), [country]);
  const selected = useMemo(() => new Set(value), [value]);

  const toggle = (code: string) =>
    onChange(selected.has(code) ? value.filter((v) => v !== code) : [...value, code]);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((code) => (
          <span
            key={code}
            className="anim-pop bg-secondary text-secondary-foreground inline-flex h-7 items-center gap-1 rounded-full pl-2.5 pr-1 text-[13px]"
          >
            {regionName(country, code)}
            <button
              type="button"
              onClick={() => toggle(code)}
              aria-label={`Remove ${regionName(country, code)}`}
              className="text-muted-foreground hover:bg-background hover:text-foreground grid size-5 place-items-center rounded-full transition-colors"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 rounded-full">
              <Plus />
              {value.length ? 'Add' : 'Add regions'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search regions…" />
              <CommandList>
                <CommandEmpty>No region found.</CommandEmpty>
                <CommandGroup>
                  {regions.map((r) => (
                    <CommandItem key={r.code} value={`${r.name} ${r.code}`} onSelect={() => toggle(r.code)}>
                      <span className="truncate">{r.name}</span>
                      <Check
                        className={cn(
                          'ml-auto transition-opacity',
                          selected.has(r.code) ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground ml-auto h-7"
          onClick={() => setShowMap((s) => !s)}
          aria-pressed={showMap}
        >
          <MapIcon />
          {showMap ? 'Hide map' : 'Show map'}
        </Button>
      </div>
      {showMap && <CountryMap country={country} selected={selected} onToggle={toggle} />}
      <p className="text-muted-foreground tnum text-xs">
        {value.length} of {regions.length} visited
      </p>
    </div>
  );
}
