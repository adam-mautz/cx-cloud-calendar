import { describe, expect, it } from 'vitest';
import { fmtZoned, wallClock, zoneAbbreviation, zonedDate } from './time';

const EASTERN = 'America/New_York';
const CENTRAL = 'America/Chicago';
const PACIFIC = 'America/Los_Angeles';

describe('zonedDate', () => {
  it('reads a wall clock time in the chosen zone', () => {
    expect(zonedDate('2026-11-09', 13 * 60, EASTERN).toISOString()).toBe('2026-11-09T18:00:00.000Z');
    expect(zonedDate('2026-11-09', 13 * 60, CENTRAL).toISOString()).toBe('2026-11-09T19:00:00.000Z');
    expect(zonedDate('2026-11-09', 13 * 60, 'UTC').toISOString()).toBe('2026-11-09T13:00:00.000Z');
  });

  it('uses daylight time in summer and standard time in winter', () => {
    expect(zonedDate('2026-07-09', 13 * 60, EASTERN).toISOString()).toBe('2026-07-09T17:00:00.000Z');
    expect(zonedDate('2026-12-09', 13 * 60, EASTERN).toISOString()).toBe('2026-12-09T18:00:00.000Z');
  });

  it('handles the days the clocks change', () => {
    expect(zonedDate('2027-03-14', 13 * 60, EASTERN).toISOString()).toBe('2027-03-14T17:00:00.000Z');
    expect(zonedDate('2026-11-01', 13 * 60, EASTERN).toISOString()).toBe('2026-11-01T18:00:00.000Z');
  });

  it('treats 1440 minutes as the following midnight', () => {
    expect(zonedDate('2026-11-09', 1440, EASTERN).toISOString()).toBe('2026-11-10T05:00:00.000Z');
  });

  it('returns an invalid date for an empty date field', () => {
    expect(Number.isNaN(zonedDate('', 60, EASTERN).getTime())).toBe(true);
  });
});

describe('wallClock', () => {
  it('reverses zonedDate', () => {
    expect(wallClock(zonedDate('2026-11-09', 13 * 60 + 15, EASTERN), EASTERN)).toEqual({ dateText: '2026-11-09', minutes: 795 });
  });

  it('can land on a different date than the viewer', () => {
    const lateEastern = zonedDate('2026-11-10', 30, EASTERN);
    expect(wallClock(lateEastern, PACIFIC)).toEqual({ dateText: '2026-11-09', minutes: 21 * 60 + 30 });
  });
});

describe('translating between zones', () => {
  it('shows a 2 PM Eastern booking as 1 PM Central', () => {
    const start = zonedDate('2026-11-07', 14 * 60, EASTERN);
    expect(fmtZoned(start, CENTRAL)).toBe('1:00 PM');
    expect(fmtZoned(start, EASTERN)).toBe('2:00 PM');
  });

  it('names the zone for the date', () => {
    expect(zoneAbbreviation(EASTERN, new Date('2026-11-07T12:00:00Z'))).toBe('EST');
    expect(zoneAbbreviation(EASTERN, new Date('2026-07-07T12:00:00Z'))).toBe('EDT');
  });
});
