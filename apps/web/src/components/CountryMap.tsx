import { geoCentroid, geoMercator, geoPath } from 'd3-geo';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { mainPart } from '@/lib/map';
import { useRegions, useWorld } from '@/lib/use-geo';
import { cn } from '@/lib/utils';

/** A small map of one country whose regions can be clicked to toggle them. */
export function CountryMap({
  country,
  selected,
  onToggle,
  className,
}: {
  country: string;
  selected: ReadonlySet<string>;
  onToggle: (code: string) => void;
  className?: string;
}) {
  const world = useWorld();
  const regions = useRegions(country);
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const height = Math.round(Math.min(260, width * 0.62));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const shapes = useMemo(() => {
    const outline = world.data?.find((f) => f.properties.iso2 === country);
    if (!outline || !regions.data || !width) return null;
    const main = mainPart(outline);
    const [lon] = geoCentroid(main);
    const projection = geoMercator()
      .rotate([-lon, 0])
      .fitExtent(
        [
          [8, 8],
          [width - 8, height - 8],
        ],
        main,
      );
    const gen = geoPath(projection);
    return regions.data.map((f) => ({ code: f.properties.code, name: f.properties.name, d: gen(f) ?? '' }));
  }, [world.data, regions.data, country, width, height]);

  const hovered = shapes?.find((s) => s.code === hover);

  return (
    <div ref={ref} className={cn('relative overflow-hidden rounded-lg border', className)}>
      {!shapes ? (
        <Skeleton className="rounded-none" style={{ height: height || 200 }} />
      ) : (
        <svg width={width} height={height} className="map anim-fade block" role="group" aria-label="Regions">
          {shapes.map((s) => (
            <path
              key={s.code}
              d={s.d}
              role="checkbox"
              aria-checked={selected.has(s.code)}
              aria-label={s.name}
              tabIndex={-1}
              className="map-region map-pick"
              data-level={selected.has(s.code) ? 2 : 0}
              onPointerEnter={() => setHover(s.code)}
              onPointerLeave={() => setHover(null)}
              onClick={() => onToggle(s.code)}
            />
          ))}
          {hovered && <path d={hovered.d} className="map-hover" />}
        </svg>
      )}
      {hovered && (
        <div className="bg-popover/90 pointer-events-none absolute left-2 top-2 rounded-md border px-2 py-1 text-xs shadow-sm backdrop-blur">
          {hovered.name}
          <span className="text-muted-foreground">
            {' '}
            · {selected.has(hovered.code) ? 'visited' : 'click to add'}
          </span>
        </div>
      )}
    </div>
  );
}
