#!/usr/bin/env node
// Encrypts vault.local.json into public/vault.json, the only file that holds
// logins, and the only form of them that is ever published.
// Must match src/lib/crypto.ts.
import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { webcrypto as crypto } from 'node:crypto';

const ITERATIONS = 600_000;
const MIN_LENGTH = 14;
const SOURCE = 'vault.local.json';
const TARGET = 'public/vault.json';

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function askHidden(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => {
      if (text.includes(prompt)) rl.output.write(prompt);
    };
    rl.question(prompt, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

function check(vault) {
  if (!Array.isArray(vault.people) || vault.people.length === 0) fail('Add at least one name to "people".');
  if (!Array.isArray(vault.accounts) || vault.accounts.length !== 2) fail('"accounts" must list exactly two logins.');
  for (const account of vault.accounts) {
    for (const field of ['id', 'label', 'username', 'password', 'loginUrl']) {
      if (!account[field]) fail(`${account.label ?? 'An account'} is missing "${field}".`);
    }
    if (!/^https:\/\//.test(account.loginUrl)) fail(`${account.label}: loginUrl must start with https://`);
  }
  for (const field of ['owner', 'repo', 'branch', 'path', 'token']) {
    if (!vault.data?.[field]) fail(`"data" is missing "${field}".`);
  }
}

let raw;
try {
  raw = readFileSync(SOURCE, 'utf8');
} catch {
  fail(`${SOURCE} not found. Copy vault.example.json to ${SOURCE} and fill it in.`);
}

let vault;
try {
  vault = JSON.parse(raw);
} catch (error) {
  fail(`${SOURCE} is not valid JSON: ${error.message}`);
}
check(vault);

console.log('\nChoose the password your team will share.');
console.log('The sealed file is public, so anyone can try guesses offline. A few random words work best.\n');
const passphrase = await askHidden('Shared password: ');
if (passphrase.length < MIN_LENGTH) fail(`Use at least ${MIN_LENGTH} characters.`);
const confirmation = await askHidden('Type it again:   ');
if (passphrase !== confirmation) fail('Those did not match. Nothing was changed.');

const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
  material,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt'],
);
const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(vault)));

const toBase64 = (bytes) => Buffer.from(bytes).toString('base64');
writeFileSync(
  TARGET,
  `${JSON.stringify({ v: 1, iterations: ITERATIONS, salt: toBase64(salt), iv: toBase64(iv), ct: toBase64(new Uint8Array(ciphertext)) }, null, 2)}\n`,
);
console.log(`\n✓ Sealed ${vault.accounts.length} accounts and ${vault.people.length} names into ${TARGET}.`);
console.log('Run "npm run deploy" to publish it.\n');
