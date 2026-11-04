import { useState, type PointerEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { endOfDay, format, isSameDay, startOfDay } from 'date-fns';
import { fmtRange, minutesIntoDay } from '../../lib/time';
import type { Account, Booking } from '../../lib/types';
import type { Prefill } from '../booking/BookingSheet';
import { bookingsOn } from './Calendar';

interface Props {
  day: Date;
  accounts: Account[];
  bookings: Booking[];
  tones: Record<string, number>;
  now: Date;
  onBook: (prefill: Prefill) => void;
  onOpen: (booking: Booking) => void;
}

const HOUR_PX = 34;
const SNAP = 15;

interface Drag {
  accountId: string;
  anchor: number;
  head: number;
}

function clampedMinutes(booking: Booking, day: Date) {
  const start = new Date(Math.max(Date.parse(booking.start), startOfDay(day).getTime()));
  const end = new Date(Math.min(Date.parse(booking.end), endOfDay(day).getTime() + 1));
  return { from: minutesIntoDay(start), to: isSameDay(end, day) ? minutesIntoDay(end) : 1440 };
}

export function DayPanel({ day, accounts, bookings, tones, now, onBook, onOpen }: Props) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const items = bookingsOn(day, bookings);
  const spans = items.map((item) => clampedMinutes(item, day));
  const firstHour = Math.min(7, ...spans.map((span) => Math.floor(span.from / 60)));
  const lastHour = Math.max(19, ...spans.map((span) => Math.ceil(span.to / 60)));
  const hours = Array.from({ length: lastHour - firstHour }, (_, index) => firstHour + index);
  const top = (minutes: number) => ((minutes - firstHour * 60) / 60) * HOUR_PX;
  const isPastDay = day < startOfDay(now);

  function minuteAt(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const raw = ((event.clientY - box.top) / HOUR_PX) * 60 + firstHour * 60;
    return Math.max(firstHour * 60, Math.min(lastHour * 60, Math.round(raw / SNAP) * SNAP));
  }

  function press(event: PointerEvent<HTMLDivElement>, accountId: string) {
    if (isPastDay || event.target !== event.currentTarget) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const minute = minuteAt(event);
    setDrag({ accountId, anchor: minute, head: minute });
  }

  function release() {
    if (!drag) return;
    const from = Math.min(drag.anchor, drag.head);
    const to = Math.max(drag.anchor, drag.head);
    setDrag(null);
    onBook({ accountId: drag.accountId, day, fromMin: from, toMin: to - from < SNAP ? from + 60 : to });
  }

  return (
    <section className="panel day" aria-label={`Schedule for ${format(day, 'MMMM d')}`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={day.toISOString()} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: 0.16 }}>
          <header className="day-head">
            <h3>{format(day, 'EEEE, MMM d')}</h3>
            <p>{isPastDay ? 'This day has passed' : 'Drag or tap a column to book'}</p>
          </header>

          <div className="lanes-head">
            <span />
            {accounts.map((account) => (
              <span key={account.id} className={`tone-${tones[account.id]}`}><i />{account.label}</span>
            ))}
          </div>

          <div className="lanes" style={{ height: hours.length * HOUR_PX }}>
            <div className="lane-hours">
              {hours.map((hour) => (
                <span key={hour} style={{ top: (hour - firstHour) * HOUR_PX }}>
                  {format(new Date(2000, 0, 1, hour), 'h a')}
                </span>
              ))}
            </div>
            {accounts.map((account) => (
              <div
                key={account.id}
                className={`lane ${isPastDay ? 'locked' : ''}`}
                style={{ backgroundSize: `100% ${HOUR_PX}px` }}
                onPointerDown={(event) => press(event, account.id)}
                onPointerMove={(event) => drag && setDrag({ ...drag, head: minuteAt(event) })}
                onPointerUp={release}
                onPointerCancel={() => setDrag(null)}
              >
                {items.filter((item) => item.accountId === account.id).map((item, index) => {
                  const span = clampedMinutes(item, day);
                  return (
                    <motion.button
                      key={item.id}
                      className={`block tone-${tones[account.id]}`}
                      style={{ top: top(span.from), height: Math.max(20, top(span.to) - top(span.from)) }}
                      initial={{ opacity: 0, scaleY: 0.5 }}
                      animate={{ opacity: 1, scaleY: 1 }}
                      transition={{ delay: index * 0.04 }}
                      onClick={() => onOpen(item)}
                      aria-label={`${item.person}, ${item.purpose}, ${fmtRange(new Date(item.start), new Date(item.end))}`}
                    >
                      <strong>{item.person}</strong>
                      <span>{item.purpose}</span>
                    </motion.button>
                  );
                })}
                {drag?.accountId === account.id && drag.anchor !== drag.head && (
                  <div
                    className={`drag tone-${tones[account.id]}`}
                    style={{ top: top(Math.min(drag.anchor, drag.head)), height: Math.abs(top(drag.head) - top(drag.anchor)) }}
                  />
                )}
              </div>
            ))}
            {isSameDay(day, now) && minutesIntoDay(now) >= firstHour * 60 && minutesIntoDay(now) <= lastHour * 60 && (
              <div className="now-line" style={{ top: top(minutesIntoDay(now)) }} />
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
