import type { Vault } from './types';

export interface Envelope {
  v: 1;
  iterations: number;
  salt: string;
  iv: string;
  ct: string;
}

const REMEMBER_DAYS = 30;
const DB = 'hot-seat';
const STORE = 'keys';
const SLOT = 'vault-key';

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function fetchEnvelope(): Promise<Envelope | null> {
  const response = await fetch(`${import.meta.env.BASE_URL}vault.json`, { cache: 'no-cache' });
  if (!response.ok) return null;
  try {
    const envelope = (await response.json()) as Envelope;
    return envelope.ct ? envelope : null;
  } catch {
    return null;
  }
}

async function deriveKey(passphrase: string, envelope: Envelope): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(envelope.salt), iterations: envelope.iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
}

async function open(key: CryptoKey, envelope: Envelope): Promise<Vault> {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(envelope.iv) }, key, fromBase64(envelope.ct));
  return JSON.parse(new TextDecoder().decode(plain)) as Vault;
}

/** Throws if the password is wrong. */
export async function unlock(passphrase: string, envelope: Envelope, remember: boolean): Promise<Vault> {
  const key = await deriveKey(passphrase, envelope);
  const vault = await open(key, envelope);
  if (remember) await saveKey(key).catch(() => undefined);
  return vault;
}

/** Reopens the vault with this browser's stored key, if it still fits. */
export async function resume(envelope: Envelope): Promise<Vault | null> {
  try {
    const saved = await readKey();
    if (!saved) return null;
    return await open(saved, envelope);
  } catch {
    await forgetKey();
    return null;
  }
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = action(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// The key is non-extractable: this browser can use it but scripts can't read it out.
function saveKey(key: CryptoKey) {
  return run('readwrite', (store) => store.put({ key, expires: Date.now() + REMEMBER_DAYS * 86_400_000 }, SLOT));
}

async function readKey(): Promise<CryptoKey | null> {
  const saved = await run<{ key: CryptoKey; expires: number } | undefined>('readonly', (store) => store.get(SLOT));
  if (!saved || saved.expires < Date.now()) return null;
  return saved.key;
}

export async function forgetKey() {
  await run('readwrite', (store) => store.delete(SLOT)).catch(() => undefined);
}
