import type { Trip } from '@globy/shared';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useHighlight } from './highlight';
import { useTripMutations } from './queries';

/** Deletes a trip at once and offers Undo in the toast. */
export function useDeleteTrip() {
  const { remove, restore } = useTripMutations();
  const { flash } = useHighlight();
  const { mutateAsync: del } = remove;
  const { mutateAsync: undo } = restore;
  // Promises rather than mutate callbacks: the row that triggered this unmounts right away, and
  // per-call callbacks don't fire for unmounted observers.
  return useCallback(
    (trip: Trip) => {
      del(trip).then(
        () =>
          toast(`Deleted “${trip.title}”`, {
            action: {
              label: 'Undo',
              onClick: () =>
                undo(trip).then(
                  () => flash(trip.id),
                  (e: Error) => toast.error('Couldn’t restore the trip', { description: e.message }),
                ),
            },
          }),
        (e: Error) => toast.error('Couldn’t delete the trip', { description: e.message }),
      );
    },
    [del, undo, flash],
  );
}
