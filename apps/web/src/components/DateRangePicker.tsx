import { CalendarDays } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatRange, plural, tripDays } from '@/lib/format';

const toDate = (iso: string) => (iso ? new Date(`${iso}T00:00:00`) : undefined);
const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function DateRangePicker({
  start,
  end,
  onChange,
  invalid,
  id,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  invalid?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const wide = useMemo(() => window.matchMedia('(min-width: 640px)').matches, []);
  const selected: DateRange | undefined = start ? { from: toDate(start), to: toDate(end) } : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          aria-invalid={invalid || undefined}
          className="aria-invalid:border-destructive w-full justify-start font-normal"
        >
          <CalendarDays className="text-muted-foreground" />
          {start ? (
            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="truncate">{formatRange(start, end || start)}</span>
              {end && (
                <span key={`${start}-${end}`} className="anim-pop text-muted-foreground tnum text-xs">
                  {plural(tripDays({ startDate: start, endDate: end }), 'day')}
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">From – to</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          numberOfMonths={wide ? 2 : 1}
          defaultMonth={selected?.from}
          selected={selected}
          captionLayout="dropdown"
          startMonth={new Date(1950, 0)}
          endMonth={new Date(new Date().getFullYear() + 5, 11)}
          onSelect={(range) => {
            if (!range?.from) return onChange('', '');
            onChange(toIso(range.from), toIso(range.to ?? range.from));
          }}
        />
        <div className="text-muted-foreground flex items-center justify-between border-t px-3 py-2 text-xs">
          <span>Pick the first and last day.</span>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setOpen(false)} disabled={!start}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
