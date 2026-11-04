# CX Cloud Calendar

A small booking board for two shared logins that can't be used at the same time. See who's on each one, claim it, and schedule time ahead.

Hosted on GitHub Pages. Bookings are kept in a separate private repo, and the app talks to it directly from the browser.

## How the protection works

The site is static, so it can't check a password on a server. Instead, the logins, the names and the data repo token are encrypted into `public/vault.json` with AES-256-GCM, using a key derived from the team password (PBKDF2-SHA256, 600,000 rounds). Nothing readable is published. The browser decrypts the vault only after the correct password is entered.

`vault.json` is public, so anyone can try guessing the password offline. Keep it long and random-looking.

## Changing logins, names, the token or the password

1. Edit `vault.local.json`. Git ignores this file, so keep it safe. `vault.example.json` shows the format.
2. Run `npm run seal` and enter the team password.
3. Run `npm run deploy`. The site updates in about a minute.

Changing the password signs everyone out, and they'll need the new one. If someone leaves the team, change the password **and** the login passwords, since they've seen the old ones.

The data repo token is a fine-grained GitHub token limited to `hot-seat-data` with Contents read and write. When it expires, the board shows a warning: create a new one and reseal.

## Development

```bash
npm install
npm run dev
```

Without a sealed vault, local development offers sample data. `npm test` runs the booking rules and storage tests.

Code changes go live with `npm run deploy`, which tests, builds and publishes to the `gh-pages` branch.
