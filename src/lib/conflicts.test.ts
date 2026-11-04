import { describe, expect, it } from 'vitest';
import {
  ConflictError,
  addBooking,
  currentBooking,
  extendBooking,
  findConflicts,
  nextBooking,
  nextFreeStart,
  pruneOld,
  releaseBooking,
  validateSlot,
} from './conflicts';
import type { Booking } from './types';

const at = (time: string) => new Date(`2026-11-05T${time}:00Z`);

function booking(id: string, start: string, end: string, accountId = 'user-1'): Booking {
  return {
    id,
    accountId,
    person: 'Sam',
    purpose: 'Demo',
    start: at(start).toISOString(),
    end: at(end).toISOString(),
    createdAt: at('00:00').toISOString(),
  };
}

const existing = [booking('a', '13:00', '15:00')];
const slot = (start: string, end: string, accountId = 'user-1') => ({ accountId, start: at(start), end: at(end) });

describe('findConflicts', () => {
  it.each([
    ['overlaps the start', '12:00', '13:30'],
    ['overlaps the end', '14:30', '16:00'],
    ['sits inside', '13:30', '14:00'],
    ['wraps around', '12:00', '16:00'],
    ['matches exactly', '13:00', '15:00'],
  ])('flags a slot that %s', (_, start, end) => {
    expect(findConflicts(slot(start, end), existing).map((item) => item.id)).toEqual(['a']);
  });

  it('allows back-to-back bookings on either side', () => {
    expect(findConflicts(slot('12:00', '13:00'), existing)).toEqual([]);
    expect(findConflicts(slot('15:00', '16:00'), existing)).toEqual([]);
  });

  it('ignores the other account', () => {
    expect(findConflicts(slot('13:00', '15:00', 'user-2'), existing)).toEqual([]);
  });

  it('can skip the booking being changed', () => {
    expect(findConflicts(slot('13:00', '15:00'), existing, 'a')).toEqual([]);
  });
});

describe('addBooking', () => {
  it('rejects an overlap and reports what it hit', () => {
    try {
      addBooking(existing, booking('b', '14:00', '16:00'));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).conflicts[0].id).toBe('a');
    }
  });

  it('adds a free slot', () => {
    expect(addBooking(existing, booking('b', '15:00', '16:00'))).toHaveLength(2);
  });
});

describe('nextFreeStart', () => {
  const hour = 3_600_000;
  const busy = [booking('a', '13:00', '15:00'), booking('b', '15:30', '17:00')];

  it('keeps the requested start when it is free', () => {
    expect(nextFreeStart('user-1', at('10:00'), hour, busy)).toEqual(at('10:00'));
  });

  it('skips a gap that is too short', () => {
    expect(nextFreeStart('user-1', at('14:00'), hour, busy)).toEqual(at('17:00'));
  });

  it('uses a gap that fits exactly', () => {
    expect(nextFreeStart('user-1', at('14:00'), hour / 2, busy)).toEqual(at('15:00'));
  });
});

describe('account status', () => {
  it('finds who holds the account now', () => {
    expect(currentBooking('user-1', at('14:00'), existing)?.id).toBe('a');
    expect(currentBooking('user-1', at('15:00'), existing)).toBeUndefined();
    expect(currentBooking('user-2', at('14:00'), existing)).toBeUndefined();
  });

  it('finds the next booking', () => {
    expect(nextBooking('user-1', at('10:00'), existing)?.id).toBe('a');
    expect(nextBooking('user-1', at('14:00'), existing)).toBeUndefined();
  });
});

describe('extendBooking', () => {
  it('pushes the end out when the time is free', () => {
    expect(extendBooking(existing, 'a', 30)[0].end).toBe(at('15:30').toISOString());
  });

  it('refuses to run into the next booking', () => {
    const busy = [...existing, booking('b', '15:15', '16:00')];
    expect(() => extendBooking(busy, 'a', 30)).toThrow(ConflictError);
  });
});

describe('releaseBooking', () => {
  it('ends a running booking at the current moment', () => {
    expect(releaseBooking(existing, 'a', at('14:00'))[0].end).toBe(at('14:00').toISOString());
  });

  it('removes a booking that has not started', () => {
    expect(releaseBooking(existing, 'a', at('10:00'))).toEqual([]);
  });
});

describe('validateSlot', () => {
  const now = at('12:00');

  it('accepts a future slot', () => {
    expect(validateSlot(slot('13:00', '14:00'), now)).toBeNull();
  });

  it('rejects an end before the start', () => {
    expect(validateSlot(slot('14:00', '13:00'), now)).toMatch(/after the start/);
  });

  it('rejects a slot in the past', () => {
    expect(validateSlot(slot('10:00', '11:00'), now)).toMatch(/passed/);
  });
});

describe('pruneOld', () => {
  it('drops bookings older than the retention window only', () => {
    const later = new Date(at('12:00').getTime() + 200 * 86_400_000);
    expect(pruneOld(existing, later)).toEqual([]);
    expect(pruneOld(existing, at('12:00'))).toHaveLength(1);
  });
});
