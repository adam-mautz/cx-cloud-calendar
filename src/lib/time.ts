import { format, isSameDay, isTomorrow, isToday } from 'date-fns';

export const toLocal = (date: Date, minutes: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, minutes);

export const minutesIntoDay = (date: Date) => date.getHours() * 60 + date.getMinutes();

export function fmtTime(date: Date) {
  return format(date, 'h:mm a');
}

/** "1p" or "1:30p", for tight spaces. */
export function fmtShort(date: Date) {
  return format(date, date.getMinutes() === 0 ? 'haaaaa' : 'h:mmaaaaa').replace('.', '').replace('.', '').toLowerCase();
}

export function fmtMinutes(minutes: number) {
  const date = new Date(2000, 0, 1, 0, minutes);
  if (minutes === 1440) return '12:00 AM (midnight)';
  return fmtTime(date);
}

export function fmtDay(date: Date) {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEE, MMM d');
}

export function fmtRange(start: Date, end: Date) {
  const sameMeridiem = format(start, 'a') === format(end, 'a') && isSameDay(start, end);
  const from = sameMeridiem ? format(start, 'h:mm') : fmtTime(start);
  return `${from} – ${isSameDay(start, end) ? fmtTime(end) : `${format(end, 'EEE')} ${fmtTime(end)}`}`;
}

export function fmtLeft(ms: number) {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export const timeZoneName = () =>
  new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(new Date()).find((part) => part.type === 'timeZoneName')?.value ?? '';

export const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export const ZONES = [
  { id: 'America/New_York', label: 'Eastern' },
  { id: 'America/Chicago', label: 'Central' },
  { id: 'America/Denver', label: 'Mountain' },
  { id: 'America/Phoenix', label: 'Arizona' },
  { id: 'America/Los_Angeles', label: 'Pacific' },
  { id: 'UTC', label: 'UTC' },
];

function offsetMs(instant: number, zone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
      .formatToParts(instant)
      .map((part) => [part.type, Number(part.value)]),
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** The instant a wall clock in `zone` reads `minutes` past midnight on `dateText` (yyyy-MM-dd). */
export function zonedDate(dateText: string, minutes: number, zone: string) {
  const [year, month, day] = dateText.split('-').map(Number);
  const wall = Date.UTC(year, month - 1, day, 0, minutes);
  if (Number.isNaN(wall)) return new Date(NaN);
  // The first guess can land on the wrong side of a daylight saving change, so correct once.
  const guess = wall - offsetMs(wall, zone);
  return new Date(wall - offsetMs(guess, zone));
}

/** What a wall clock in `zone` reads at `date`. */
export function wallClock(date: Date, zone: string) {
  const shifted = new Date(date.getTime() + offsetMs(date.getTime(), zone));
  return {
    dateText: shifted.toISOString().slice(0, 10),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

export function zoneAbbreviation(zone: string, date = new Date()) {
  return new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' }).formatToParts(date).find((part) => part.type === 'timeZoneName')?.value ?? zone;
}

export function fmtZoned(date: Date, zone: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(date);
}

export function zoneOptions() {
  const local = localZone();
  const known = ZONES.some((zone) => zone.id === local);
  const all = known ? ZONES : [{ id: local, label: local.split('/').pop()!.replace(/_/g, ' ') }, ...ZONES];
  return all.map((zone) => ({
    id: zone.id,
    label: `${zone.label} (${zoneAbbreviation(zone.id)})${zone.id === local ? ', your time' : ''}`,
  }));
}
