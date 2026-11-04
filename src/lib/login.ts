import type { Account } from './types';

/** Salesforce's login page fills in the username from `un`. The password never goes in the link. */
export function loginLink(account: Account) {
  const url = new URL(account.loginUrl);
  url.searchParams.set('un', account.username);
  return url.toString();
}
