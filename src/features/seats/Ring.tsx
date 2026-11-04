import { motion } from 'motion/react';

const RADIUS = 52;
const LENGTH = 2 * Math.PI * RADIUS;

/** Remaining time on a booking, drawn as a shrinking ring. */
export function Ring({ fraction, label }: { fraction: number; label: string }) {
  return (
    <div className="ring" role="img" aria-label={`${label} left`}>
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={RADIUS} className="ring-track" />
        <motion.circle
          cx="60"
          cy="60"
          r={RADIUS}
          className="ring-value"
          strokeDasharray={LENGTH}
          initial={{ strokeDashoffset: LENGTH }}
          animate={{ strokeDashoffset: LENGTH * (1 - fraction) }}
          transition={{ type: 'spring', stiffness: 60, damping: 18 }}
        />
      </svg>
      <div className="ring-label">
        <strong>{label}</strong>
        <span>left</span>
      </div>
    </div>
  );
}
