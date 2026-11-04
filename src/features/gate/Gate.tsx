import { useEffect, useRef, useState, type FormEvent } from 'react';
import { motion, useAnimationControls } from 'motion/react';
import { unlock, type Envelope } from '../../lib/crypto';
import type { Vault } from '../../lib/types';
import { Icon } from '../../components/Icon';

interface Props {
  envelope: Envelope | null;
  onOpen: (vault: Vault) => void;
  onSample?: () => void;
}

export function Gate({ envelope, onOpen, onSample }: Props) {
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const card = useAnimationControls();

  useEffect(() => input.current?.focus(), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!envelope || !password || busy) return;
    setBusy(true);
    setWrong(false);
    try {
      onOpen(await unlock(password, envelope, remember));
    } catch {
      setWrong(true);
      setBusy(false);
      setPassword('');
      input.current?.focus();
      void card.start({ x: [0, -12, 10, -7, 5, -2, 0], transition: { duration: 0.45 } });
    }
  }

  return (
    <motion.main className="gate" exit={{ opacity: 0, scale: 1.06, filter: 'blur(10px)' }} transition={{ duration: 0.4 }}>
      <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 170, damping: 22 }}>
        <motion.form className="gate-card" animate={card} onSubmit={submit}>
          <div className="gate-mark">
            <Icon name="lock" size={22} />
          </div>
          <h1>Hot Seat</h1>
          {envelope ? (
            <>
              <p>Enter the team password to continue.</p>
              <label className="sr-only" htmlFor="password">Team password</label>
              <input
                ref={input}
                id="password"
                className={`input ${wrong ? 'invalid' : ''}`}
                type="password"
                autoComplete="current-password"
                placeholder="Team password"
                value={password}
                aria-invalid={wrong}
                aria-describedby={wrong ? 'password-error' : undefined}
                onChange={(event) => setPassword(event.target.value)}
              />
              {wrong && <p id="password-error" className="gate-error" role="alert">That password didn't work. Try again.</p>}
              <label className="check">
                <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                <span>Keep me signed in on this device for 30 days</span>
              </label>
              <button className="btn primary wide" disabled={busy || !password}>
                {busy ? <span className="spinner" /> : 'Unlock'}
              </button>
            </>
          ) : onSample ? (
            <>
              <p>No sealed vault found. Sample data is available in local development.</p>
              <button type="button" className="btn primary wide" onClick={onSample}>Open with sample data</button>
            </>
          ) : (
            <p>This board hasn't been set up yet.</p>
          )}
        </motion.form>
      </motion.div>
    </motion.main>
  );
}
