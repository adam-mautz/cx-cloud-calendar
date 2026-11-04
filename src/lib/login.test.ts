import { describe, expect, it } from 'vitest';
import { loginLink } from './login';

const base =
  'https://org.develop.my.salesforce.com/?ec=302&startURL=%2Fvisualforce%2Fsession%3Furl%3Dhttps%253A%252F%252Forg.lightning.force.com%252Flightning%252Fn%252Fdevedapp__Welcome';
const account = { id: 'user-1', label: 'User 1', username: 'demo+1@example.test', password: 'secret-value', loginUrl: base };

describe('loginLink', () => {
  it('adds the username, safely encoded', () => {
    expect(new URL(loginLink(account)).searchParams.get('un')).toBe('demo+1@example.test');
    expect(loginLink(account)).toContain('un=demo%2B1%40example.test');
  });

  it('keeps the redirect exactly as it was', () => {
    expect(new URL(loginLink(account)).searchParams.get('startURL')).toBe(new URL(base).searchParams.get('startURL'));
    expect(loginLink(account).startsWith(base)).toBe(true);
  });

  it('never puts the password in the link', () => {
    expect(loginLink(account)).not.toContain('secret-value');
  });

  it('works on a link with no query string', () => {
    expect(loginLink({ ...account, loginUrl: 'https://org.my.salesforce.com/' })).toBe('https://org.my.salesforce.com/?un=demo%2B1%40example.test');
  });
});
