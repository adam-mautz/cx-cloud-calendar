import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  addMonths,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { fmtShort } from '../../lib/time';
import type { Booking } from '../../lib/types';
import { Icon } from '../../components/Icon';

interface Props {
  bookings: Booking[];
  tones: Record<string, number>;
  selected: Date;
  now: Date;
  onSelect: (day: Date) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function bookingsOn(day: Date, bookings: Booking[]) {
  const from = startOfDay(day).getTime();
  const to = endOfDay(day).getTime();
  return bookings
    .filter((booking) => Date.parse(booking.start) <= to && Date.parse(booking.end) > from)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

export function Calendar({ bookings, tones, selected, now, onSelect }: Props) {
  const [month, setMonth] = useState(() => startOfMonth(now));
  const [direction, setDirection] = useState(1);

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) }),
    [month],
  );

  function shift(by: number) {
    setDirection(by);
    setMonth((current) => addMonths(current, by));
  }

  function goToday() {
    const target = startOfMonth(now);
    setDirection(target < month ? -1 : 1);
    setMonth(target);
    onSelect(startOfDay(now));
  }

  return (
    <section className="panel calendar" aria-label="Booking calendar">
      <header className="cal-head">
        <div className="cal-month">
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.h3
              key={month.toISOString()}
              initial={{ y: direction * 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: direction * -16, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {format(month, 'MMMM yyyy')}
            </motion.h3>
          </AnimatePresence>
        </div>
        <div className="cal-nav">
          <button className="btn ghost small" onClick={goToday}>Today</button>
          <button className="icon-btn" aria-label="Previous month" onClick={() => shift(-1)}><Icon name="left" /></button>
          <button className="icon-btn" aria-label="Next month" onClick={() => shift(1)}><Icon name="right" /></button>
        </div>
      </header>

      <div className="cal-weekdays" aria-hidden="true">
        {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={month.toISOString()}
          className="cal-grid"
          initial={{ x: direction * 36, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: direction * -36, opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {days.map((day) => {
            const items = bookingsOn(day, bookings);
            const isPast = day < startOfDay(now);
            const isSelected = isSameDay(day, selected);
            const names = items.map((item) => `${item.person}, ${item.purpose}`).join('; ');
            return (
              <button
                key={day.toISOString()}
                className={[
                  'cal-day',
                  isSameMonth(day, month) ? '' : 'outside',
                  isPast ? 'past' : '',
                  isToday(day) ? 'today' : '',
                ].join(' ')}
                aria-pressed={isSelected}
                aria-label={`${format(day, 'EEEE, MMMM d')}: ${items.length ? names : 'free'}`}
                onClick={() => onSelect(day)}
              >
                {isSelected && <motion.span layoutId="selected-day" className="cal-selected" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <span className="cal-num">{format(day, 'd')}</span>
                <span className="cal-chips">
                  {items.slice(0, 2).map((item) => (
                    <span key={item.id} className={`chip tone-${tones[item.accountId]}`}>
                      <b>{fmtShort(new Date(item.start))}</b> {item.person}
                    </span>
                  ))}
                  {items.length > 2 && <span className="chip-more">+{items.length - 2} more</span>}
                </span>
                <span className="cal-dots" aria-hidden="true">
                  {items.slice(0, 4).map((item) => <i key={item.id} className={`tone-${tones[item.accountId]}`} />)}
                </span>
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
