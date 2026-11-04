import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { startOfDay } from 'date-fns';
import { ConflictError, addBooking, currentBooking, extendBooking, releaseBooking } from './lib/conflicts';
import { fmtRange, fmtTime, timeZoneName } from './lib/time';
import type { BookingStore } from './lib/store/types';
import type { Booking, Vault } from './lib/types';
import { useBookings, type SyncState } from './hooks/useBookings';
import { useNow } from './hooks/useNow';
import { Icon } from './components/Icon';
import { Toasts, useToasts } from './components/Toasts';
import { Seat } from './features/seats/Seat';
import { Calendar } from './features/calendar/Calendar';
import { DayPanel } from './features/calendar/DayPanel';
import { Upcoming } from './features/calendar/Upcoming';
import { BookingSheet, type Prefill } from './features/booking/BookingSheet';
import { Details } from './features/booking/Details';

const ME_KEY = 'hot-seat:me';

function readMe() {
  try {
    return localStorage.getItem(ME_KEY) ?? '';
  } catch {
    return '';
  }
}

const SYNC_TEXT: Record<SyncState, string> = {
  loading: 'Connecting',
  live: 'Live',
  offline: 'Reconnecting',
  denied: 'Sync stopped',
};

interface Props {
  vault: Vault;
  store: BookingStore;
  onLock: () => void;
}

export function Board({ vault, store, onLock }: Props) {
  const { accounts, people } = vault;
  const { bookings, loaded, sync, refresh, mutate } = useBookings(store);
  const now = useNow(1_000);
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [details, setDetails] = useState<Booking | null>(null);
  const [me, setMe] = useState(readMe);
  const { toasts, push } = useToasts();

  const tones = useMemo(() => Object.fromEntries(accounts.map((account, index) => [account.id, index + 1])), [accounts]);
  const labelOf = useCallback((id: string) => accounts.find((account) => account.id === id)?.label ?? '', [accounts]);

  useEffect(() => {
    document.body.classList.toggle('no-scroll', Boolean(prefill || details));
  }, [prefill, details]);

  const remember = useCallback((name: string) => {
    setMe(name);
    try {
      localStorage.setItem(ME_KEY, name);
    } catch {
      // Private windows can block storage. The name just won't be prefilled.
    }
  }, []);

  const saveBooking = useCallback(
    async (booking: Booking) => {
      const start = new Date(booking.start);
      try {
        await mutate((items) => addBooking(items, booking), `Book ${labelOf(booking.accountId)}: ${booking.person}`);
      } catch (error) {
        if (error instanceof ConflictError) await refresh();
        throw error;
      }
      remember(booking.person);
      push(`${labelOf(booking.accountId)} booked, ${fmtRange(start, new Date(booking.end))}`);
    },
    [labelOf, mutate, push, refresh, remember],
  );

  async function attempt(action: () => Promise<void>, success: string) {
    try {
      await action();
      push(success);
    } catch (error) {
      if (error instanceof ConflictError) {
        await refresh();
        push(`${error.conflicts[0].person} has the next slot, so this can't run longer.`, 'error');
      } else {
        push(error instanceof Error ? error.message : 'Something went wrong.', 'error');
      }
    }
  }

  const extend = (booking: Booking) =>
    attempt(() => mutate((items) => extendBooking(items, booking.id, 30), `Extend ${labelOf(booking.accountId)}`), 'Added 30 minutes');

  const release = (booking: Booking) => {
    setDetails(null);
    const running = new Date(booking.start) <= new Date();
    return attempt(
      () => mutate((items) => releaseBooking(items, booking.id, new Date()), `Release ${labelOf(booking.accountId)}`),
      running ? `${labelOf(booking.accountId)} is free now` : 'Booking canceled',
    );
  };

  const held = accounts.map((account) => currentBooking(account.id, now, bookings));
  const free = accounts.filter((_, index) => !held[index]);
  const soonest = held.filter((item): item is Booking => Boolean(item)).sort((a, b) => Date.parse(a.end) - Date.parse(b.end))[0];
  const headline = !loaded
    ? "Checking who's on…"
    : free.length === accounts.length
      ? 'Both logins are free.'
      : free.length > 0
        ? `${free[0].label} is free.`
        : `Both logins are in use. One frees up at ${soonest ? fmtTime(new Date(soonest.end)) : 'soon'}.`;
  const overlayOpen = Boolean(prefill || details);

  return (
    <motion.div className="board" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <header className="topbar" inert={overlayOpen}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><i /><i /></span>
          Hot Seat
        </div>
        <div className="topbar-right">
          <span className={`sync ${sync}`} title="Updates every 20 seconds"><i />{SYNC_TEXT[sync]}</span>
          <button className="icon-btn" aria-label="Lock" title="Lock" onClick={onLock}><Icon name="lock" size={17} /></button>
        </div>
      </header>

      {sync === 'denied' && (
        <div className="banner" role="alert">
          <Icon name="alert" size={16} />
          Bookings can't load or save because the access token isn't working. It may have expired, so it needs to be replaced. {loaded ? 'What you see may be out of date.' : "Availability can't be shown until then."}
        </div>
      )}
      {sync === 'offline' && (
        <div className="banner" role="alert">
          <Icon name="alert" size={16} />
          Can't reach GitHub right now, so what you see may be out of date. Retrying automatically.
        </div>
      )}

      <main className="content" inert={overlayOpen}>
        <p className="headline" aria-live="polite">{headline}</p>

        <div className="seats">
          {accounts.map((account) => (
            <Seat
              key={account.id}
              account={account}
              tone={tones[account.id]}
              bookings={bookings}
              now={now}
              me={me}
              loaded={loaded}
              onClaim={(accountId) => setPrefill({ accountId, now: true })}
              onExtend={extend}
              onEnd={setDetails}
            />
          ))}
        </div>

        <div className="planner-head">
          <div>
            <h2>Calendar</h2>
            <p>Times shown in your time zone ({timeZoneName()})</p>
          </div>
          <div className="legend">
            {accounts.map((account) => <span key={account.id} className={`tone-${tones[account.id]}`}><i />{account.label}</span>)}
          </div>
          <motion.button className="btn primary book" disabled={!loaded} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setPrefill({ day: selected >= startOfDay(now) ? selected : now })}>
            <Icon name="plus" size={18} /> Book a login
          </motion.button>
        </div>

        <div className="planner">
          <Calendar bookings={bookings} tones={tones} selected={selected} now={now} onSelect={setSelected} />
          <DayPanel day={selected} accounts={accounts} bookings={bookings} tones={tones} now={now} onBook={setPrefill} onOpen={setDetails} />
        </div>

        <Upcoming accounts={accounts} bookings={bookings} tones={tones} now={now} onOpen={setDetails} />
      </main>

      <AnimatePresence>
        {prefill && (
          <BookingSheet
            prefill={prefill}
            people={people}
            accounts={accounts}
            tones={tones}
            bookings={bookings}
            now={now}
            me={me}
            onSave={saveBooking}
            onClose={() => setPrefill(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {details && (
          <Details
            booking={details}
            account={accounts.find((account) => account.id === details.accountId)}
            tone={tones[details.accountId]}
            now={now}
            onClose={() => setDetails(null)}
            onRemove={release}
          />
        )}
      </AnimatePresence>

      <Toasts toasts={toasts} />
    </motion.div>
  );
}
