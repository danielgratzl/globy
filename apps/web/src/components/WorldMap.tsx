import { geoEqualEarth, geoPath, type GeoProjection } from 'd3-geo';
import { select } from 'd3-selection';
import 'd3-transition';
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import { Minus, Plus, Undo2 } from 'lucide-react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { CountryFeature, RegionFeature } from '@/lib/geo';
import { mainPart, prefersReducedMotion, visitLevel } from '@/lib/map';
import { useRegions, useWorld } from '@/lib/use-geo';
import { cn } from '@/lib/utils';

export interface CountryVisitInfo {
  trips: number;
  /** Only planned trips so far. */
  upcoming?: boolean;
  /** Trips per visited region code. */
  regions?: Map<string, number>;
}

type Hover = { x: number; y: number; country: string; region?: RegionFeature };

const ASPECT = 0.47;
const MAX_ZOOM = 60;

/** Hatched fill for places that are only planned so far. */
function Defs() {
  return (
    <defs>
      <pattern
        id="map-hatch"
        width="6"
        height="6"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width="6" height="6" className="fill-[var(--map-land)]" />
        <line x1="0" y1="0" x2="0" y2="6" className="stroke-[var(--visit-2)]" strokeWidth="2.5" />
      </pattern>
    </defs>
  );
}

const Countries = memo(function Countries({
  features,
  paths,
  visits,
  focus,
  onHover,
  onLeave,
  onClick,
}: {
  features: CountryFeature[];
  paths: string[];
  visits: Map<string, CountryVisitInfo>;
  focus: string | null;
  onHover: (e: React.PointerEvent, country: string) => void;
  onLeave: () => void;
  onClick: (country: string) => void;
}) {
  return (
    <g>
      {features.map((f, i) => {
        const iso = f.properties.iso2;
        const v = visits.get(iso);
        return (
          <path
            key={iso}
            d={paths[i]}
            data-level={v && !v.upcoming ? visitLevel(v.trips) : 0}
            data-upcoming={v?.upcoming || undefined}
            data-dim={(focus && focus !== iso) || undefined}
            data-focus={focus === iso || undefined}
            className="map-country"
            onPointerMove={(e) => onHover(e, iso)}
            onPointerLeave={onLeave}
            onClick={() => onClick(iso)}
          />
        );
      })}
    </g>
  );
});

export function WorldMap({
  visits,
  focus,
  onFocusChange,
  renderTooltip,
  overlay,
  className,
}: {
  visits: Map<string, CountryVisitInfo>;
  focus: string | null;
  onFocusChange: (country: string | null) => void;
  renderTooltip: (country: string, region?: RegionFeature) => React.ReactNode;
  /** Shown in the corner while a country is in focus. */
  overlay?: React.ReactNode;
  className?: string;
}) {
  const world = useWorld();
  const regions = useRegions(focus);
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const layerRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown>>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<Hover | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const height = Math.round(width * ASPECT);
  const ready = !!world.data;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const features = world.data;
  const { projection, paths } = useMemo(() => {
    if (!features || !width) return { projection: null, paths: [] as string[] };
    // Frame the inhabited world; Antarctica is still drawn, just cropped.
    const framed = {
      type: 'FeatureCollection' as const,
      features: features.filter((f) => f.properties.iso2 !== 'AQ'),
    };
    const p: GeoProjection = geoEqualEarth().fitExtent(
      [
        [4, 4],
        [width - 4, height - 4],
      ],
      framed,
    );
    const gen = geoPath(p);
    return { projection: p, paths: features.map((f) => gen(f) ?? '') };
  }, [features, width, height]);

  const regionPaths = useMemo(() => {
    if (!projection || !regions.data) return [];
    const gen = geoPath(projection);
    return regions.data.map((f) => ({ f, d: gen(f) ?? '' }));
  }, [projection, regions.data]);

  // Pan and zoom.
  useEffect(() => {
    if (!svgRef.current || !width) return;
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, MAX_ZOOM])
      .translateExtent([
        [0, 0],
        [width, height],
      ])
      // Wheel zoom needs a modifier and touch needs two fingers, so the page still scrolls past the map.
      .filter((e: Event) =>
        e.type === 'wheel'
          ? (e as WheelEvent).ctrlKey || (e as WheelEvent).metaKey
          : e.type.startsWith('touch')
            ? (e as TouchEvent).touches.length >= 2
            : !(e as MouseEvent).button,
      )
      .on('zoom', (e: { transform: { k: number; toString(): string } }) => {
        layerRef.current?.setAttribute('transform', e.transform.toString());
        svgRef.current?.style.setProperty('--map-k', String(e.transform.k));
        setZoomed(e.transform.k > 1.01);
      });
    zoomRef.current = z;
    const svg = select(svgRef.current);
    svg.call(z).on('dblclick.zoom', null);
    return () => {
      svg.on('.zoom', null);
    };
    // The svg only exists once the world data has loaded.
  }, [width, height, ready]);

  // Zoom to the focused country, or back out to the world.
  useEffect(() => {
    const z = zoomRef.current;
    if (!z || !svgRef.current || !projection || !features) return;
    const svg = select(svgRef.current);
    const duration = prefersReducedMotion() ? 0 : 850;
    const target = focus ? features.find((f) => f.properties.iso2 === focus) : undefined;
    if (!target) {
      svg.transition().duration(duration).call(z.transform, zoomIdentity);
      return;
    }
    const [[x0, y0], [x1, y1]] = geoPath(projection).bounds(mainPart(target));
    const k = Math.min(MAX_ZOOM, 0.8 / Math.max((x1 - x0) / width, (y1 - y0) / height));
    const t = zoomIdentity
      .translate(width / 2, height / 2)
      .scale(k)
      .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    svg.transition().duration(duration).call(z.transform, t);
  }, [focus, projection, features, width, height]);

  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) onFocusChange(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus, onFocusChange]);

  const onHover = useCallback((e: React.PointerEvent, country: string) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, country });
  }, []);
  const onLeave = useCallback(() => setHover(null), []);
  const onClick = useCallback(
    (country: string) => onFocusChange(country === focus ? null : country),
    [focus, onFocusChange],
  );

  const zoomBy = (factor: number) => {
    if (zoomRef.current && svgRef.current)
      select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, factor);
  };

  const focusVisits = focus ? visits.get(focus)?.regions : undefined;
  const hoverIndex = hover && features ? features.findIndex((f) => f.properties.iso2 === hover.country) : -1;

  return (
    <div ref={wrapRef} className={cn('relative w-full touch-pan-y select-none', className)}>
      {!features || !width ? (
        world.error ? (
          <div
            className="text-muted-foreground grid place-items-center rounded-xl border text-sm"
            style={{ aspectRatio: `1 / ${ASPECT}` }}
          >
            {world.error.message}
          </div>
        ) : (
          <Skeleton className="w-full rounded-xl" style={{ aspectRatio: `1 / ${ASPECT}` }} />
        )
      ) : (
        <svg
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="World map of visited countries"
          className="map anim-fade block cursor-grab active:cursor-grabbing"
        >
          <Defs />
          <g ref={layerRef}>
            <Countries
              features={features}
              paths={paths}
              visits={visits}
              focus={focus}
              onHover={onHover}
              onLeave={onLeave}
              onClick={onClick}
            />
            {focus && regionPaths.length > 0 && (
              <g key={focus} className="map-regions">
                {regionPaths.map(({ f, d }) => (
                  <path
                    key={f.properties.code}
                    d={d}
                    className="map-region"
                    data-level={visitLevel(focusVisits?.get(f.properties.code) ?? 0)}
                    onPointerMove={(e) => {
                      const rect = wrapRef.current!.getBoundingClientRect();
                      setHover({
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                        country: focus,
                        region: f,
                      });
                    }}
                    onPointerLeave={onLeave}
                    onClick={(e) => e.stopPropagation()}
                  />
                ))}
              </g>
            )}
            {hoverIndex >= 0 && !hover?.region && hover?.country !== focus && (
              <path d={paths[hoverIndex]} className="map-hover" />
            )}
          </g>
        </svg>
      )}

      {hover && (
        <div
          className="bg-popover text-popover-foreground pointer-events-none absolute z-10 min-w-36 rounded-lg border px-3 py-2 text-xs shadow-md"
          style={{
            left: Math.min(hover.x + 14, width - 180),
            top: Math.max(0, hover.y - 12),
            transform: hover.y > height * 0.6 ? 'translateY(-100%)' : undefined,
          }}
        >
          {renderTooltip(hover.country, hover.region)}
        </div>
      )}

      {features && width > 0 && (
        <div className="absolute bottom-2 right-2 hidden flex-col gap-1 sm:flex">
          <Button
            variant="outline"
            size="icon-sm"
            className="bg-background/80 backdrop-blur"
            onClick={() => zoomBy(1.6)}
            aria-label="Zoom in"
          >
            <Plus />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            className="bg-background/80 backdrop-blur"
            onClick={() => zoomBy(1 / 1.6)}
            aria-label="Zoom out"
          >
            <Minus />
          </Button>
        </div>
      )}

      {(focus || zoomed) && (
        <div className="anim-fade absolute left-2 top-2 flex max-w-[calc(100%-1rem)] flex-col items-start gap-2">
          <Button
            variant="outline"
            size="sm"
            className="bg-background/80 backdrop-blur"
            onClick={() => (focus ? onFocusChange(null) : zoomBy(1 / MAX_ZOOM))}
          >
            <Undo2 />
            World
          </Button>
          {focus && overlay}
        </div>
      )}
    </div>
  );
}
