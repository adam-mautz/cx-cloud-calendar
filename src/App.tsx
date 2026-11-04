import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { fetchEnvelope, forgetKey, resume, type Envelope } from './lib/crypto';
import { GitHubStore } from './lib/store/github';
import { MockStore, mockVault } from './lib/store/mock';
import type { BookingStore } from './lib/store/types';
import type { Vault } from './lib/types';
import { Aurora } from './components/Aurora';
import { Gate } from './features/gate/Gate';
import { Board } from './Board';

interface Session {
  vault: Vault;
  store: BookingStore;
}

export function App() {
  const [ready, setReady] = useState(false);
  const [envelope, setEnvelope] = useState<Envelope | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  const openVault = useMemo(() => (vault: Vault) => setSession({ vault, store: new GitHubStore(vault.data) }), []);

  useEffect(() => {
    void (async () => {
      const found = await fetchEnvelope().catch(() => null);
      setEnvelope(found);
      const vault = found ? await resume(found) : null;
      if (vault) openVault(vault);
      setReady(true);
    })();
  }, [openVault]);

  async function lock() {
    await forgetKey();
    setSession(null);
  }

  const openSample = import.meta.env.DEV ? () => setSession({ vault: mockVault, store: new MockStore() }) : undefined;

  return (
    <>
      <Aurora />
      <AnimatePresence mode="wait">
        {session ? (
          <Board key="board" vault={session.vault} store={session.store} onLock={lock} />
        ) : ready ? (
          <Gate key="gate" envelope={envelope} onOpen={openVault} onSample={openSample} />
        ) : null}
      </AnimatePresence>
    </>
  );
}
