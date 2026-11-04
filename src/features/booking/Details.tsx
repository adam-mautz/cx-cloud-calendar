import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { fmtDay, fmtRange, fmtZoned, localZone, zoneAbbreviation } from '../../lib/time';
import type { Account, Booking } from '../../lib/types';
import { Icon } from '../../components/Icon';

interface Props {
  booking: Booking;
  account?: Account;
  tone: number;
  now: Date;
  onClose: () => void;
  onRemove: (booking: Booking) => void;
}

export function Details({ booking, account, tone, now, onClose, onRemove }: Props) {
  const [confirming, setConfirming] = useState(false);
  const start = new Date(booking.start);
  const end = new Date(booking.end);
  const running = start <= now && now < end;
  const finished = end <= now;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div className="scrim center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className={`details tone-${tone}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${booking.person}'s booking`}
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 10 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="icon-btn close" aria-label="Close" autoFocus onClick={onClose}><Icon name="x" /></button>
        <p className="eyebrow">{account?.label}</p>
        <h3>{booking.person}</h3>
        <p className="details-what">{booking.purpose}{booking.note ? ` · ${booking.note}` : ''}</p>
        <p className="details-when">{fmtDay(start)}, {fmtRange(start, end)}</p>
        {booking.timeZone && booking.timeZone !== localZone() && (
          <p className="details-when">
            Booked as {fmtZoned(start, booking.timeZone)} – {fmtZoned(end, booking.timeZone)} {zoneAbbreviation(booking.timeZone, start)}
          </p>
        )}
        {!finished && (
          confirming ? (
            <div className="details-actions">
              <button className="btn danger small" onClick={() => onRemove(booking)}>{running ? 'Yes, end it now' : 'Yes, cancel it'}</button>
              <button className="btn ghost small" onClick={() => setConfirming(false)}>Keep it</button>
            </div>
          ) : (
            <div className="details-actions">
              <button className="btn ghost small" onClick={() => setConfirming(true)}>{running ? 'End now' : 'Cancel booking'}</button>
            </div>
          )
        )}
      </motion.div>
    </motion.div>
  );
}
