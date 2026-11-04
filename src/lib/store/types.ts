import type { Booking } from '../types';

export class StoreAccessError extends Error {}

export interface BookingStore {
  /** Returns null when nothing has changed since the last load. */
  load(): Promise<Booking[] | null>;
  /**
   * Applies a change on top of the latest saved bookings. `apply` may rerun if
   * someone else saved first, and may throw to abort (e.g. on a conflict).
   */
  mutate(apply: (bookings: Booking[]) => Booking[], message: string): Promise<Booking[]>;
}
