import { addDays, addMinutes, setHours, setMinutes, startOfDay } from 'date-fns';
import type { Booking, Vault } from '../types';
import type { BookingStore } from './types';

// Local development only. Nothing here reaches the deployed site.
export const mockVault: Vault = {
  people: ['Alex', 'Blair', 'Casey', 'Drew', 'Emery', 'Finley', 'Gray', 'Harper', 'Indigo', 'Jordan', 'Kit'],
  accounts: [
    { id: 'user-1', label: 'User 1', username: 'demo.user1@example.test', password: 'mock-password-1', loginUrl: 'https://example.test/one' },
    { id: 'user-2', label: 'User 2', username: 'demo.user2@example.test', password: 'mock-password-2', loginUrl: 'https://example.test/two' },
  ],
  data: { owner: '', repo: '', branch: '', path: '', token: '' },
};

function seed(): Booking[] {
  const now = new Date();
  const today = startOfDay(now);
  const at = (day: number, hour: number, minute = 0) => setMinutes(setHours(addDays(today, day), hour), minute);
  const make = (id: string, accountId: string, person: string, purpose: Booking['purpose'], start: Date, end: Date, note?: string): Booking => ({
    id, accountId, person, purpose, note, start: start.toISOString(), end: end.toISOString(), createdAt: now.toISOString(),
  });
  return [
    make('m1', 'user-1', 'Casey', 'Demo', addMinutes(now, -50), addMinutes(now, 70), 'Northwind discovery'),
    make('m2', 'user-1', 'Blair', 'Testing', addMinutes(now, 95), addMinutes(now, 200)),
    make('m3', 'user-2', 'Emery', 'Demo', at(1, 13), at(1, 15), 'Contoso exec review'),
    make('m4', 'user-1', 'Alex', 'Demo', at(1, 9), at(1, 10, 30), 'Fabrikam'),
    make('m5', 'user-2', 'Finley', 'Build', at(2, 10), at(2, 16)),
    make('m6', 'user-1', 'Harper', 'Training', at(3, 14), at(3, 16)),
    make('m7', 'user-2', 'Gray', 'Demo', at(5, 11), at(5, 12)),
    make('m8', 'user-1', 'Drew', 'Demo', at(6, 9), at(6, 11)),
    make('m9', 'user-2', 'Indigo', 'Testing', at(6, 13), at(6, 17)),
    make('m10', 'user-1', 'Jordan', 'Demo', at(9, 15), at(9, 16, 30)),
  ];
}

export class MockStore implements BookingStore {
  private bookings = seed();
  private served = false;

  async load(): Promise<Booking[] | null> {
    if (this.served) return null;
    this.served = true;
    return this.bookings;
  }

  async mutate(apply: (bookings: Booking[]) => Booking[]): Promise<Booking[]> {
    await new Promise((resolve) => setTimeout(resolve, 450));
    this.bookings = apply(this.bookings);
    return this.bookings;
  }
}
