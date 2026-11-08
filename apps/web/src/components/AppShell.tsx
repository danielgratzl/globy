import { Globe2, List, Plus, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { useEffect } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { TripSheet } from '@/components/TripSheet';
import { Button } from '@/components/ui/button';
import { useTrips } from '@/lib/queries';
import { useSheet } from '@/lib/sheet';
import { cn } from '@/lib/utils';

interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}

export function Logo({ className }: { className?: string }) {
  return <img src="/globy-logo.svg" alt="" className={cn('size-7', className)} />;
}

/** Keyboard shortcuts: N adds a trip, / focuses the page's search field. */
function useShortcuts(add: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === 'n') {
        e.preventDefault();
        add();
      } else if (e.key === '/') {
        const search = document.querySelector<HTMLInputElement>('[data-search]');
        if (search) {
          e.preventDefault();
          search.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [add]);
}

export function AppShell() {
  const { data: trips = [] } = useTrips();
  const sheet = useSheet();
  const add = () => sheet.add();
  useShortcuts(add);

  const nav: NavEntry[] = [
    { to: '/', label: 'Dashboard', icon: Globe2 },
    { to: '/trips', label: 'Trips', icon: List, count: trips.length },
    { to: '/settings', label: 'Settings', icon: SlidersHorizontal },
  ];

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[224px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r px-3 py-5 md:flex">
        <div className="pb-6">
          <Link
            to="/"
            className="focus-visible:ring-ring/50 group flex w-max items-center gap-2.5 rounded-md px-2.5 outline-none focus-visible:ring-[3px]"
          >
            <Logo className="ease-snappy transition-transform duration-700 group-hover:rotate-[24deg]" />
            <span className="text-[17px] font-semibold tracking-tight">Globy</span>
          </Link>
        </div>
        <Button className="mb-5 w-full justify-start" onClick={add}>
          <Plus />
          Add trip
          <span className="border-primary-foreground/25 ml-auto rounded border px-1.5 text-[11px] font-normal opacity-70">
            N
          </span>
        </Button>
        <nav className="space-y-0.5" aria-label="Main">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                cn(
                  'focus-visible:ring-ring/50 flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm outline-none transition-colors focus-visible:ring-[3px]',
                  isActive
                    ? 'bg-accent text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )
              }
            >
              <n.icon className="size-4" />
              {n.label}
              {!!n.count && (
                <span key={n.count} className="anim-pop text-muted-foreground tnum ml-auto text-xs">
                  {n.count}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">
        <main className="mx-auto max-w-6xl px-4 pb-[calc(96px+env(safe-area-inset-bottom,0px))] pt-5 sm:px-8 md:pb-16 md:pt-8">
          <Outlet />
        </main>
      </div>

      <nav
        aria-label="Main"
        className="bg-background/95 fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t pb-[env(safe-area-inset-bottom,0px)] backdrop-blur md:hidden"
      >
        {nav.slice(0, 2).map((n) => (
          <MobileLink key={n.to} entry={n} />
        ))}
        <button
          type="button"
          onClick={add}
          className="text-foreground flex h-14 flex-col items-center justify-center gap-1 text-[11px]"
        >
          <span className="bg-primary text-primary-foreground grid h-7 w-12 place-items-center rounded-full transition-transform active:scale-90">
            <Plus className="size-[18px]" />
          </span>
          Add
        </button>
        <MobileLink entry={nav[2]!} />
      </nav>

      <TripSheet />
    </div>
  );
}

function MobileLink({ entry: n }: { entry: NavEntry }) {
  return (
    <NavLink
      to={n.to}
      end={n.to === '/'}
      className={({ isActive }) =>
        cn(
          'flex h-14 flex-col items-center justify-center gap-1 text-[11px] transition-colors',
          isActive ? 'text-foreground' : 'text-muted-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'grid h-7 w-12 place-items-center rounded-full transition-colors duration-200',
              isActive && 'bg-accent',
            )}
          >
            <n.icon className="size-[18px]" />
          </span>
          {n.label}
        </>
      )}
    </NavLink>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
        {subtitle && <p className="text-muted-foreground tnum mt-0.5 text-sm">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}
