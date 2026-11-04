import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { addMinutes, format, isSameDay, startOfDay } from 'date-fns';
import { ConflictError, findConflicts, nextFreeStart, validateSlot } from '../../lib/conflicts';
import { fmtDay, fmtMinutes, fmtRange, fmtZoned, localZone, minutesIntoDay, timeZoneName, wallClock, zonedDate, zoneOptions } from '../../lib/time';
import { PURPOSES, type Account, type Booking, type Purpose, type Slot } from '../../lib/types';
import { Icon } from '../../components/Icon';

export interface Prefill {
  accountId?: string;
  now?: boolean;
  day?: Date;
  fromMin?: number;
  toMin?: number;
}

interface Props {
  prefill: Prefill;
  people: string[];
  accounts: Account[];
  tones: Record<string, number>;
  bookings: Booking[];
  now: Date;
  me: string;
  onSave: (booking: Booking) => Promise<void>;
  onClose: () => void;
}

const CUSTOM = '__custom';
const DURATIONS = [30, 60, 120, 240];
const STEPS = Array.from({ length: 97 }, (_, index) => index * 15);

function nextQuarter(date: Date) {
  return Math.ceil((minutesIntoDay(date) + 1) / 15) * 15;
}

/** A running booking can end off the 15-minute grid, so keep the current value selectable. */
function stepsWith(value: number, steps: number[]) {
  return steps.includes(value) ? steps : [...steps, value].sort((a, b) => a - b);
}

function label(minutes: number) {
  return minutes < 60 ? `${minutes} min` : `${minutes / 60} hr`;
}

export function BookingSheet({ prefill, people, accounts, tones, bookings, now, me, onSave, onClose }: Props) {
  const roster = useMemo(() => [...people].sort((a, b) => a.localeCompare(b)), [people]);
  const known = roster.includes(me);
  const startsToday = !prefill.day || isSameDay(prefill.day, now);
  const defaultStart = startsToday ? Math.min(nextQuarter(now), 1380) : 9 * 60;

  const [choice, setChoice] = useState(known ? me : me ? CUSTOM : '');
  const [custom, setCustom] = useState(known ? '' : me);
  const [accountId, setAccountId] = useState(prefill.accountId ?? accounts[0].id);
  const [mode, setMode] = useState<'now' | 'later'>(prefill.now ? 'now' : 'later');
  const [duration, setDuration] = useState(60);
  const [dateText, setDateText] = useState(format(prefill.day ?? now, 'yyyy-MM-dd'));
  const [fromMin, setFromMin] = useState(prefill.fromMin ?? defaultStart);
  const [toMin, setToMin] = useState(prefill.toMin ?? Math.min(defaultStart + 60, 1440));
  const [zone, setZone] = useState(localZone);
  const [purpose, setPurpose] = useState<Purpose>('Demo');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState('');
  const [justTaken, setJustTaken] = useState(false);
  const [done, setDone] = useState(false);
  const [added, setAdded] = useState<string[]>([]);

  const person = (choice === CUSTOM ? custom : choice).trim();
  const zones = useMemo(zoneOptions, []);
  const sameZoneDay = (a: Date, b: Date) => wallClock(a, zone).dateText === wallClock(b, zone).dateText;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const range = useMemo(() => {
    if (mode === 'now') {
      const start = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
      return { start, end: addMinutes(start, duration) };
    }
    return { start: zonedDate(dateText, fromMin, zone), end: zonedDate(dateText, toMin, zone) };
  }, [mode, now, duration, dateText, fromMin, toMin, zone]);

  const slot: Slot = { accountId, ...range };
  const lengthMs = range.end.getTime() - range.start.getTime();
  const timeError = validateSlot(slot, now);
  const conflicts = timeError ? [] : findConflicts(slot, bookings);
  const other = accounts.find((account) => account.id !== accountId);
  const otherFree = other && !timeError && findConflicts({ ...range, accountId: other.id }, bookings).length === 0;
  const laterStart = conflicts.length ? nextFreeStart(accountId, range.start, lengthMs, bookings) : null;
  const laterEnd = laterStart ? new Date(laterStart.getTime() + lengthMs) : null;
  const canSlide = laterStart !== null && laterEnd !== null && sameZoneDay(laterStart, laterEnd);
  const blocker = conflicts[0] ? new Date(conflicts[0].start) : null;
  const canShorten = blocker !== null && blocker.getTime() - range.start.getTime() >= 15 * 60_000;

  function shortenTo(end: Date) {
    setJustTaken(false);
    if (mode === 'now') setDuration(Math.floor((end.getTime() - range.start.getTime()) / 60_000));
    else setToMin(wallClock(end, zone).minutes);
  }

  function moveTo(start: Date, end: Date) {
    setMode('later');
    const from = wallClock(start, zone);
    setDateText(from.dateText);
    setFromMin(from.minutes);
    setToMin(wallClock(end, zone).minutes);
    setJustTaken(false);
  }

  function setLength(minutes: number) {
    setToMin(Math.min(fromMin + minutes, 1440));
  }

  async function save(another: boolean) {
    if (!person || timeError || conflicts.length > 0 || saving) return;
    setSaving(true);
    setProblem('');
    setJustTaken(false);
    try {
      await onSave({
        id: crypto.randomUUID(),
        accountId,
        person,
        purpose,
        note: note.trim() || undefined,
        start: range.start.toISOString(),
        end: range.end.toISOString(),
        timeZone: mode === 'now' ? localZone() : zone,
        createdAt: new Date().toISOString(),
      });
      if (another) {
        const line = `${accounts.find((account) => account.id === accountId)?.label}, ${fmtDay(range.start)}, ${fmtRange(range.start, range.end)}`;
        setAdded((items) => [...items, line]);
        setNote('');
        const nextEnd = new Date(range.end.getTime() + lengthMs);
        setMode('later');
        if (sameZoneDay(range.end, nextEnd)) moveTo(range.end, nextEnd);
      } else {
        setDone(true);
        setTimeout(onClose, 1100);
      }
    } catch (error) {
      if (error instanceof ConflictError) setJustTaken(true);
      else setProblem(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  const ready = person && !timeError && conflicts.length === 0;

  return (
    <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.aside
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        initial={{ x: '102%' }}
        animate={{ x: 0 }}
        exit={{ x: '102%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        onClick={(event) => event.stopPropagation()}
      >
        <AnimatePresence>{done && <Success />}</AnimatePresence>

        <header className="sheet-head">
          <h2 id="sheet-title">Book a login</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
        </header>

        <div className="sheet-body">
          <AnimatePresence initial={false}>
            {added.length > 0 && (
              <motion.ul className="added" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}>
                {added.map((line) => <li key={line}><Icon name="check" size={14} /> {line}</li>)}
              </motion.ul>
            )}
          </AnimatePresence>

          <div className="group">
            <label className="group-label" htmlFor="person">Who's booking?</label>
            <select id="person" className="input" autoFocus value={choice} onChange={(event) => setChoice(event.target.value)}>
              <option value="" disabled>Choose your name</option>
              {roster.map((name) => <option key={name} value={name}>{name}</option>)}
              <option value={CUSTOM}>Someone else…</option>
            </select>
            <AnimatePresence initial={false}>
              {choice === CUSTOM && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="reveal">
                  <label className="sr-only" htmlFor="custom-person">Name</label>
                  <input id="custom-person" className="input" placeholder="Name" autoFocus maxLength={30} value={custom} onChange={(event) => setCustom(event.target.value)} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="group">
            <span className="group-label">When?</span>
            <div className="segment" role="group" aria-label="Start time">
              {(['now', 'later'] as const).map((value) => (
                <button key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>
                  {mode === value && <motion.span layoutId="mode" className="segment-thumb" transition={{ type: 'spring', stiffness: 460, damping: 36 }} />}
                  <span>{value === 'now' ? 'Right now' : 'Schedule'}</span>
                </button>
              ))}
            </div>

            {mode === 'now' ? (
              <div className="chips" role="group" aria-label="How long?">
                {DURATIONS.map((minutes) => (
                  <button key={minutes} className="choice" aria-pressed={duration === minutes} onClick={() => setDuration(minutes)}>{label(minutes)}</button>
                ))}
              </div>
            ) : (
              <>
                <div className="when-grid">
                  <label className="mini">
                    <span>Date</span>
                    <input className="input" type="date" min={format(startOfDay(now), 'yyyy-MM-dd')} value={dateText} onChange={(event) => setDateText(event.target.value)} />
                  </label>
                  <label className="mini">
                    <span>From</span>
                    <select className="input" value={fromMin} onChange={(event) => {
                      const next = Number(event.target.value);
                      setToMin(Math.min(next + Math.max(toMin - fromMin, 15), 1440));
                      setFromMin(next);
                    }}>
                      {stepsWith(fromMin, STEPS.slice(0, 96)).map((minutes) => <option key={minutes} value={minutes}>{fmtMinutes(minutes)}</option>)}
                    </select>
                  </label>
                  <label className="mini">
                    <span>To</span>
                    <select className="input" value={toMin} onChange={(event) => setToMin(Number(event.target.value))}>
                      {stepsWith(toMin, STEPS.slice(1)).map((minutes) => <option key={minutes} value={minutes}>{fmtMinutes(minutes)}</option>)}
                    </select>
                  </label>
                </div>
                <label className="mini">
                  <span>Time zone</span>
                  <select className="input" value={zone} onChange={(event) => setZone(event.target.value)}>
                    {zones.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </label>
                {zone !== localZone() && !timeError && (
                  <p className="zone-note">That's {fmtDay(range.start)}, {fmtRange(range.start, range.end)} your time ({timeZoneName()})</p>
                )}
                <div className="chips" role="group" aria-label="Set length">
                  {DURATIONS.map((minutes) => (
                    <button key={minutes} className="choice" aria-pressed={toMin - fromMin === minutes} onClick={() => setLength(minutes)}>{label(minutes)}</button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="group">
            <span className="group-label">Which login?</span>
            <div className="account-picks">
              {accounts.map((account) => {
                const clash = timeError ? [] : findConflicts({ ...range, accountId: account.id }, bookings);
                return (
                  <button
                    key={account.id}
                    className={`account-pick tone-${tones[account.id]} ${clash.length ? 'taken' : ''}`}
                    aria-pressed={accountId === account.id}
                    onClick={() => setAccountId(account.id)}
                  >
                    <strong>{account.label}</strong>
                    <span>{clash.length ? `${clash[0].person} has it` : 'Free'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <AnimatePresence initial={false}>
            {(conflicts.length > 0 || justTaken) && (
              <motion.div
                className="conflict"
                role="alert"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <div className="conflict-inner">
                  <p className="conflict-title"><Icon name="alert" size={16} /> {justTaken && conflicts.length === 0 ? 'Someone just took that time' : 'That time is taken'}</p>
                  {conflicts.map((item) => (
                    <p key={item.id} className="conflict-line">
                      <strong>{item.person}</strong> has it for {item.purpose.toLowerCase()}, {fmtRange(new Date(item.start), new Date(item.end))}
                    </p>
                  ))}
                  <div className="conflict-fixes">
                    {otherFree && other && <button className="btn ghost small" onClick={() => setAccountId(other.id)}>Use {other.label} instead</button>}
                    {canShorten && blocker && <button className="btn ghost small" onClick={() => shortenTo(blocker)}>End at {fmtZoned(blocker, zone)} instead</button>}
                    {canSlide && laterStart && laterEnd ? (
                      <button className="btn ghost small" onClick={() => moveTo(laterStart, laterEnd)}>Move to {fmtZoned(laterStart, zone)}{isSameDay(laterStart, range.start) ? '' : `, ${fmtDay(laterStart)}`}</button>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {timeError && <p className="time-error" role="alert">{timeError}</p>}

          <div className="group">
            <span className="group-label">What's it for?</span>
            <div className="chips" role="group" aria-label="Purpose">
              {PURPOSES.map((value) => (
                <button key={value} className="choice" aria-pressed={purpose === value} onClick={() => setPurpose(value)}>{value}</button>
              ))}
            </div>
            <label className="sr-only" htmlFor="note">Details</label>
            <input id="note" className="input" placeholder="Customer or details (optional)" maxLength={80} value={note} onChange={(event) => setNote(event.target.value)} />
          </div>

          {problem && <p className="time-error" role="alert">{problem}</p>}
        </div>

        <footer className="sheet-foot">
          <button className="btn ghost" disabled={!ready || saving} onClick={() => save(true)}>
            <Icon name="plus" size={16} /> Book & add another
          </button>
          <button className="btn primary" disabled={!ready || saving} onClick={() => save(false)}>
            {saving ? <span className="spinner" /> : 'Book it'}
          </button>
        </footer>
      </motion.aside>
    </motion.div>
  );
}

function Success() {
  const sparks = Array.from({ length: 16 }, (_, index) => (index / 16) * Math.PI * 2);
  return (
    <motion.div className="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="success-burst">
        {sparks.map((angle, index) => (
          <motion.i
            key={angle}
            className={index % 2 ? 'spark-a' : 'spark-b'}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(angle) * 130, y: Math.sin(angle) * 130, opacity: 0, scale: 0.3 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        ))}
        <motion.svg viewBox="0 0 80 80" width="96" height="96" initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 16 }}>
          <circle cx="40" cy="40" r="38" fill="var(--mint)" />
          <motion.path d="M24 41l11 11 21-24" fill="none" stroke="var(--ink-950)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.12, duration: 0.3 }} />
        </motion.svg>
      </div>
      <p>You're booked</p>
    </motion.div>
  );
}
