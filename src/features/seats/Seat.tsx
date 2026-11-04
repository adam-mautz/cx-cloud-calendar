import { useState, type PointerEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { currentBooking, nextBooking } from '../../lib/conflicts';
import { fmtDay, fmtLeft, fmtTime } from '../../lib/time';
import type { Account, Booking } from '../../lib/types';
import { Icon } from '../../components/Icon';
import { CopyField } from './CopyField';
import { Ring } from './Ring';

interface Props {
  account: Account;
  tone: number;
  bookings: Booking[];
  now: Date;
  me: string;
  loaded: boolean;
  failed: boolean;
  onClaim: (accountId: string) => void;
  onExtend: (booking: Booking) => void;
  onEnd: (booking: Booking) => void;
}

const swap = {
  initial: { opacity: 0, y: 16, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -16, filter: 'blur(6px)' },
  transition: { duration: 0.28 },
};

export function Seat({ account, tone, bookings, now, me, loaded, failed, onClaim, onExtend, onEnd }: Props) {
  const [warning, setWarning] = useState(false);
  const active = currentBooking(account.id, now, bookings);
  const upcoming = nextBooking(account.id, now, bookings);
  const heldByOther = active && active.person !== me;

  function track(event: PointerEvent<HTMLElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--mx', `${event.clientX - box.left}px`);
    event.currentTarget.style.setProperty('--my', `${event.clientY - box.top}px`);
  }

  function openLogin() {
    setWarning(false);
    window.open(account.loginUrl, '_blank', 'noopener,noreferrer');
  }

  const total = active ? Date.parse(active.end) - Date.parse(active.start) : 1;
  const left = active ? Date.parse(active.end) - now.getTime() : 0;

  return (
    <motion.article
      className={`seat tone-${tone} ${!loaded ? 'unknown' : active ? 'busy' : 'free'}`}
      onPointerMove={track}
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 150, damping: 20, delay: 0.08 * tone }}
    >
      <header className="seat-top">
        <h2>{account.label}</h2>
        {loaded ? (
          <span className={`pill ${active ? 'pill-busy' : 'pill-free'}`}>
            <i />
            {active ? 'In use' : 'Available'}
          </span>
        ) : (
          <span className="pill pill-unknown"><i />{failed ? 'Unknown' : 'Checking'}</span>
        )}
      </header>

      <div className="seat-status">
        <AnimatePresence mode="wait" initial={false}>
          {!loaded ? (
            <motion.div key="unknown" className="status-copy" {...swap}>
              <p className={`status-name unknown-word ${failed ? 'still' : ''}`}>{failed ? 'Unknown' : 'Checking…'}</p>
              <p className="status-detail">{failed ? "Can't tell who's on this login right now" : "Looking up who's on this login"}</p>
            </motion.div>
          ) : active ? (
            <motion.div key={active.id} className="status-row" {...swap}>
              <div className="status-copy">
                <p className="status-name">{active.person}</p>
                <p className="status-detail">
                  {active.purpose}{active.note ? ` · ${active.note}` : ''}
                </p>
                <p className="status-sub">Until {fmtTime(new Date(active.end))}</p>
              </div>
              <Ring fraction={Math.min(1, left / total)} label={fmtLeft(left)} />
            </motion.div>
          ) : (
            <motion.div key="free" className="status-copy" {...swap}>
              <p className="status-name free-word">Free</p>
              <p className="status-detail">
                {upcoming
                  ? `Next: ${upcoming.person}, ${fmtDay(new Date(upcoming.start))} at ${fmtTime(new Date(upcoming.start))}`
                  : 'Nothing booked'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="seat-actions">
        {!loaded ? null : active ? (
          <>
            <button className="btn ghost" onClick={() => onExtend(active)}>
              <Icon name="plus" size={16} /> 30 min
            </button>
            <button className="btn ghost" onClick={() => onEnd(active)}>End now</button>
          </>
        ) : (
          <button className="btn claim" onClick={() => onClaim(account.id)}>
            <Icon name="bolt" size={16} /> Claim now
          </button>
        )}
      </div>

      <div className="seat-login">
        <AnimatePresence initial={false}>
          {warning && heldByOther && (
            <motion.div
              className="kick-warning"
              role="alert"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <div>
                <p><strong>{active.person} is using this login.</strong> Logging in will sign them out.</p>
                <div className="kick-actions">
                  <button className="btn danger small" onClick={openLogin}>Log in anyway</button>
                  <button className="btn ghost small" onClick={() => setWarning(false)}>Cancel</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <button className="btn login wide" onClick={() => (heldByOther ? setWarning(true) : openLogin())}>
          Log in as {account.label} <Icon name="out" size={17} />
        </button>
        <CopyField label="Username" value={account.username} />
        <CopyField label="Password" value={account.password} secret />
      </div>
    </motion.article>
  );
}
