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
