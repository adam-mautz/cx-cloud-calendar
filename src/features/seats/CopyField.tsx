import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from '../../components/Icon';

interface Props {
  label: string;
  value: string;
  secret?: boolean;
}

export function CopyField({ label, value, secret }: Props) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(value);
      setFailed(false);
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      setFailed(true);
      setRevealed(true);
    }
  }

  return (
    <div className={`field ${copied ? 'copied' : ''}`}>
      <span className="field-label">{label}</span>
      <code className="field-value">{secret && !revealed ? '•'.repeat(12) : value}</code>
      {secret && (
        <button className="icon-btn" aria-label={revealed ? `Hide ${label}` : `Show ${label}`} aria-pressed={revealed} onClick={() => setRevealed(!revealed)}>
          <Icon name={revealed ? 'eyeOff' : 'eye'} size={16} />
        </button>
      )}
      <button className="icon-btn copy" aria-label={failed ? `Couldn't copy ${label}` : `Copy ${label}`} onClick={copy}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={copied ? 'done' : 'copy'}
            initial={{ scale: 0.4, opacity: 0, rotate: -30 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ duration: 0.13 }}
          >
            <Icon name={copied ? 'check' : 'copy'} size={16} />
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  );
}
