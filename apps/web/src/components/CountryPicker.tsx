import { COUNTRIES, flagOf } from '@globy/shared';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import { countryName } from '@/lib/format';
import { cn } from '@/lib/utils';

export function CountryPicker({
  value,
  onChange,
  recent = [],
  invalid,
  id,
}: {
  value: string;
  onChange: (code: string) => void;
  /** Countries shown first, e.g. the ones visited most. */
  recent?: string[];
  invalid?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const options = useMemo(
    () =>
      COUNTRIES.map((c) => ({ code: c.code, name: countryName(c.code), alt: c.name })).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [],
  );
  const recentOptions = recent.map((code) => options.find((o) => o.code === code)).filter((o) => !!o);

  const item = (o: (typeof options)[number], group: string) => (
    <CommandItem
      key={`${group}-${o.code}`}
      value={`${group} ${o.name} ${o.alt} ${o.code}`}
      onSelect={() => {
        onChange(o.code);
        setOpen(false);
      }}
    >
      <span className="text-base leading-none">{flagOf(o.code)}</span>
      <span className="truncate">{o.name}</span>
      <Check className={cn('ml-auto transition-opacity', value === o.code ? 'opacity-100' : 'opacity-0')} />
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          className="aria-invalid:border-destructive w-full justify-between font-normal"
        >
          {value ? (
            <span key={value} className="anim-pop flex items-center gap-2">
              <span className="text-base leading-none">{flagOf(value)}</span>
              {countryName(value)}
            </span>
          ) : (
            <span className="text-muted-foreground">Choose a country</span>
          )}
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Search countries…" />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            {recentOptions.length > 0 && (
              <CommandGroup heading="Visited">{recentOptions.map((o) => item(o, 'visited'))}</CommandGroup>
            )}
            <CommandGroup heading={recentOptions.length ? 'All countries' : undefined}>
              {options.map((o) => item(o, 'all'))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
