import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from './Icon';

interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'error';
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const push = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    counter.current += 1;
    const id = counter.current;
    setToasts((items) => [...items, { id, text, kind }]);
    setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 4200);
  }, []);
  return { toasts, push };
}

export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            className={`toast ${toast.kind}`}
            initial={{ opacity: 0, y: 24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          >
            <Icon name={toast.kind === 'ok' ? 'check' : 'alert'} size={16} />
            {toast.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
