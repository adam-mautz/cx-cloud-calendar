#!/usr/bin/env node
// Tests, builds and publishes dist/ to the gh-pages branch, which GitHub Pages serves.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const REMOTE = 'https://github.com/adam-mautz/cx-cloud-calendar.git';
const WORK = '.deploy';
const run = (command, cwd = '.') => execSync(command, { cwd, stdio: 'inherit' });
const quiet = (command, cwd = '.') => execSync(command, { cwd, stdio: 'pipe' }).toString().trim();

run('npm test');
run('npm run build');

if (existsSync('public/vault.json') && quiet('git status --porcelain public/vault.json')) {
  run('git add public/vault.json');
  run('git commit -q -m "Update sealed vault"');
  run('git push -q origin main');
}

rmSync(WORK, { recursive: true, force: true });
if (quiet(`git ls-remote --heads ${REMOTE} gh-pages`)) {
  run(`git clone -q --depth 1 --branch gh-pages ${REMOTE} ${WORK}`);
} else {
  mkdirSync(WORK);
  run('git init -q -b gh-pages', WORK);
  run(`git remote add origin ${REMOTE}`, WORK);
}

for (const entry of readdirSync(WORK)) {
  if (entry !== '.git') rmSync(join(WORK, entry), { recursive: true });
}
cpSync('dist', WORK, { recursive: true });

run('git add -A', WORK);
if (quiet('git status --porcelain', WORK)) {
  run('git -c user.name="cx-cloud-calendar deploy" -c user.email="deploy@users.noreply.github.com" commit -q -m "Deploy site"', WORK);
  run('git push -q origin gh-pages', WORK);
  console.log('\n✓ Deployed. The site updates in about a minute: https://adam-mautz.github.io/cx-cloud-calendar/\n');
} else {
  console.log('\nNothing changed, so there was nothing to deploy.\n');
}
rmSync(WORK, { recursive: true, force: true });
