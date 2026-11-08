import type {
  ApiError,
  Backup,
  Buddy,
  BuddyCreate,
  ImportRequest,
  ImportResult,
  Trip,
  TripCreate,
  TripPatch,
} from '@globy/shared';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, headers: { accept: 'application/json' } };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { ...init.headers, 'content-type': 'application/json' };
  }
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiRequestError(0, 'network', 'Can’t reach Globy. Check your connection.');
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as T | ApiError | null;
  if (!res.ok) {
    const err = (data as ApiError | null)?.error;
    throw new ApiRequestError(
      res.status,
      err?.code ?? 'unknown',
      err?.message ?? 'Something went wrong.',
      err?.fields,
    );
  }
  return data as T;
}

export const api = {
  trips: {
    list: () => request<{ trips: Trip[] }>('GET', '/api/trips').then((r) => r.trips),
    create: (input: TripCreate) => request<Trip>('POST', '/api/trips', input),
    update: (id: string, patch: TripPatch) => request<Trip>('PATCH', `/api/trips/${id}`, patch),
    remove: (id: string) => request<void>('DELETE', `/api/trips/${id}`),
    restore: (id: string) => request<Trip>('POST', `/api/trips/${id}/restore`),
  },
  buddies: {
    list: () => request<{ buddies: Buddy[] }>('GET', '/api/buddies').then((r) => r.buddies),
    create: (input: BuddyCreate) => request<Buddy>('POST', '/api/buddies', input),
    rename: (id: string, name: string) => request<Buddy>('PATCH', `/api/buddies/${id}`, { name }),
    remove: (id: string) => request<{ removedFromTrips: number }>('DELETE', `/api/buddies/${id}`),
  },
  exportBackup: () => request<Backup>('GET', '/api/export'),
  importBackup: (input: ImportRequest) => request<ImportResult>('POST', '/api/import', input),
};
