import { useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

export type SheetState = { mode: 'add'; country?: string } | { mode: 'edit'; id: string } | null;

const KEYS = ['trip', 'in'];

/** The trip sheet lives in the URL, so it can be linked and closed with the back button. */
export function useSheet() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const trip = params.get('trip');
  const state: SheetState =
    trip === 'new'
      ? { mode: 'add', country: params.get('in') ?? undefined }
      : trip
        ? { mode: 'edit', id: trip }
        : null;

  const go = useCallback(
    (next: Record<string, string>, replace = false) => {
      const p = new URLSearchParams(params);
      KEYS.forEach((k) => p.delete(k));
      Object.entries(next).forEach(([k, v]) => v && p.set(k, v));
      setParams(p, { replace, state: replace ? location.state : { sheet: true } });
    },
    [params, setParams, location.state],
  );

  return {
    state,
    add: (country?: string) => go({ trip: 'new', in: country ?? '' }, !!state),
    edit: (id: string) => go({ trip: id }, !!state),
    close: () => {
      if ((location.state as { sheet?: boolean } | null)?.sheet) navigate(-1);
      else go({}, true);
    },
  };
}
