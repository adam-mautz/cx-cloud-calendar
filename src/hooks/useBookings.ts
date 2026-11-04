import { useCallback, useEffect, useState } from 'react';
import type { BookingStore } from '../lib/store/types';
import { StoreAccessError } from '../lib/store/types';
import type { Booking } from '../lib/types';

const POLL_MS = 20_000;

export type SyncState = 'loading' | 'live' | 'offline' | 'denied';

export function useBookings(store: BookingStore) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [sync, setSync] = useState<SyncState>('loading');
  // Until the first load lands, an empty list means "unknown", not "free".
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const latest = await store.load();
      if (latest) setBookings(latest);
      setLoaded(true);
      setSync('live');
    } catch (error) {
      setSync(error instanceof StoreAccessError ? 'denied' : 'offline');
    }
  }, [store]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_MS);
    const onFocus = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const mutate = useCallback(
    async (apply: (items: Booking[]) => Booking[], message: string) => {
      setBookings(await store.mutate(apply, message));
    },
    [store],
  );

  return { bookings, loaded, sync, refresh, mutate };
}
