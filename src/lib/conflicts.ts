import type { Booking, Slot } from './types';

const MINUTE = 60_000;

export class ConflictError extends Error {
  constructor(readonly conflicts: Booking[]) {
    super('That time was just taken.');
  }
}

/** Back-to-back bookings are fine: one ending at 3:00 does not clash with one starting at 3:00. */
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

function times(booking: Booking) {
  return { start: Date.parse(booking.start), end: Date.parse(booking.end) };
}

function forAccount(accountId: string, bookings: Booking[]) {
  return bookings
    .filter((booking) => booking.accountId === accountId)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

export function findConflicts(slot: Slot, bookings: Booking[], ignoreId?: string): Booking[] {
  return forAccount(slot.accountId, bookings).filter((booking) => {
    if (booking.id === ignoreId) return false;
    const { start, end } = times(booking);
    return overlaps(slot.start.getTime(), slot.end.getTime(), start, end);
  });
}

/** The earliest start at or after `from` with `durationMs` free on this account. */
export function nextFreeStart(accountId: string, from: Date, durationMs: number, bookings: Booking[]): Date {
  let cursor = from.getTime();
  for (const booking of forAccount(accountId, bookings)) {
    const { start, end } = times(booking);
    if (end <= cursor) continue;
    if (start >= cursor + durationMs) break;
    cursor = Math.max(cursor, end);
  }
  return new Date(cursor);
}

export function currentBooking(accountId: string, now: Date, bookings: Booking[]): Booking | undefined {
  const at = now.getTime();
  return forAccount(accountId, bookings).find((booking) => {
    const { start, end } = times(booking);
    return start <= at && at < end;
  });
}

export function nextBooking(accountId: string, now: Date, bookings: Booking[]): Booking | undefined {
  return forAccount(accountId, bookings).find((booking) => Date.parse(booking.start) > now.getTime());
}

/** Returns why a slot can't be booked, or null if its times are fine. */
export function validateSlot(slot: Slot, now: Date): string | null {
  if (Number.isNaN(slot.start.getTime()) || Number.isNaN(slot.end.getTime())) return 'Pick a date and time.';
  if (slot.end <= slot.start) return 'The end time needs to be after the start time.';
  if (slot.end <= now) return 'That time has already passed.';
  if (slot.end.getTime() - slot.start.getTime() < 5 * MINUTE) return 'Bookings need to be at least 5 minutes.';
  return null;
}

/** Shared by every write path, so a stale screen can never double-book. */
export function addBooking(bookings: Booking[], booking: Booking): Booking[] {
  const slot = { accountId: booking.accountId, start: new Date(booking.start), end: new Date(booking.end) };
  const conflicts = findConflicts(slot, bookings);
  if (conflicts.length > 0) throw new ConflictError(conflicts);
  return [...bookings, booking];
}

export function extendBooking(bookings: Booking[], id: string, minutes: number): Booking[] {
  const booking = bookings.find((item) => item.id === id);
  if (!booking) return bookings;
  const end = new Date(Date.parse(booking.end) + minutes * MINUTE);
  const conflicts = findConflicts({ accountId: booking.accountId, start: new Date(booking.end), end }, bookings, id);
  if (conflicts.length > 0) throw new ConflictError(conflicts);
  return bookings.map((item) => (item.id === id ? { ...item, end: end.toISOString() } : item));
}

/** Ends a running booking now, or removes one that hasn't started. */
export function releaseBooking(bookings: Booking[], id: string, now: Date): Booking[] {
  const booking = bookings.find((item) => item.id === id);
  if (!booking) return bookings;
  if (Date.parse(booking.start) >= now.getTime()) return bookings.filter((item) => item.id !== id);
  return bookings.map((item) => (item.id === id ? { ...item, end: now.toISOString() } : item));
}

const KEEP_DAYS = 120;

export function pruneOld(bookings: Booking[], now: Date): Booking[] {
  const cutoff = now.getTime() - KEEP_DAYS * 24 * 60 * MINUTE;
  return bookings.filter((booking) => Date.parse(booking.end) >= cutoff);
}
