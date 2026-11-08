import { useEffect, useState } from 'react';
import { loadRegions, loadWorld, type CountryFeature, type RegionFeature } from './geo';

type State<T> = { data: T | undefined; error: Error | undefined };

function useAsync<T>(fn: (() => Promise<T>) | null, key: string): State<T> {
  const [state, setState] = useState<State<T> & { key?: string }>({ data: undefined, error: undefined });
  useEffect(() => {
    if (!fn) return;
    let live = true;
    fn().then(
      (data) => live && setState({ data, error: undefined, key }),
      (error: Error) => live && setState({ data: undefined, error, key }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state.key === key ? state : { data: undefined, error: undefined };
}

export const useWorld = () => useAsync<CountryFeature[]>(loadWorld, 'world');

export const useRegions = (country: string | null | undefined, enabled = true) =>
  useAsync<RegionFeature[]>(country && enabled ? () => loadRegions(country) : null, `regions:${country}`);
