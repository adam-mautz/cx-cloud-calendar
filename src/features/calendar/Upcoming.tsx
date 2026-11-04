import { AnimatePresence, motion } from 'motion/react';
import { fmtDay, fmtRange } from '../../lib/time';
import type { Account, Booking } from '../../lib/types';

interface Props {
  accounts: Account[];
  bookings: Booking[];
  tones: Record<string, number>;
  now: Date;
  onOpen: (booking: Booking) => void;
}

export function Upcoming({ accounts, bookings, tones, now, onOpen }: Props) {
  const next = bookings
    .filter((booking) => Date.parse(booking.end) > now.getTime())
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .slice(0, 8);

  return (
    <section className="upcoming" aria-label="Upcoming bookings">
      <h3>Coming up</h3>
      {next.length === 0 ? (
        <p className="muted">Nothing booked. Both logins are wide open.</p>
      ) : (
        <ol className="upcoming-list">
          <AnimatePresence initial={false}>
            {next.map((booking, index) => {
              const start = new Date(booking.start);
              return (
                <motion.li
                  key={booking.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <button className={`up-card tone-${tones[booking.accountId]}`} onClick={() => onOpen(booking)}>
                    <span className="up-when">{fmtDay(start)}</span>
                    <strong>{booking.person}</strong>
                    <span className="up-what">{booking.purpose} · {accounts.find((account) => account.id === booking.accountId)?.label}</span>
                    <span className="up-time">{fmtRange(start, new Date(booking.end))}</span>
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      )}
    </section>
  );
}
