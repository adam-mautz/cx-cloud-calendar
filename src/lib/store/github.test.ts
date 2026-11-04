import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, addBooking } from '../conflicts';
import type { Booking } from '../types';
import { GitHubStore } from './github';
import { StoreAccessError } from './types';

const config = { owner: 'o', repo: 'r', branch: 'main', path: 'bookings.json', token: 't' };

function booking(id: string, startHour: number, endHour: number): Booking {
  const future = new Date(Date.now() + 86_400_000);
  const at = (hour: number) => new Date(Date.UTC(future.getUTCFullYear(), future.getUTCMonth(), future.getUTCDate(), hour)).toISOString();
  return { id, accountId: 'user-1', person: 'Sam', purpose: 'Demo', start: at(startHour), end: at(endHour), createdAt: at(0) };
}

/** A tiny stand-in for the GitHub contents API, including its stale-sha rejection. */
function fakeGitHub(initial: Booking[]) {
  const state = { bookings: initial, version: 1 };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64');
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit = {}) => {
    if (init.method === 'PUT') {
      const body = JSON.parse(init.body as string) as { sha?: string; content: string };
      if (body.sha !== `sha-${state.version}`) return new Response('{}', { status: 409 });
      state.bookings = JSON.parse(Buffer.from(body.content, 'base64').toString()).bookings;
      state.version += 1;
      return new Response('{}', { status: 200 });
    }
    const etag = `"v${state.version}"`;
    if (new Headers(init.headers).get('If-None-Match') === etag) return new Response(null, { status: 304 });
    return new Response(JSON.stringify({ content: encode({ bookings: state.bookings }), sha: `sha-${state.version}` }), {
      status: 200,
      headers: { ETag: etag },
    });
  });
  return state;
}

afterEach(() => vi.unstubAllGlobals());

describe('GitHubStore', () => {
  it('reports no change when the file is unchanged', async () => {
    fakeGitHub([booking('a', 13, 15)]);
    const store = new GitHubStore(config);
    expect(await store.load()).toHaveLength(1);
    expect(await store.load()).toBeNull();
  });

  it('treats a 404 as lost access, never as an empty board', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 404 }));
    await expect(new GitHubStore(config).load()).rejects.toBeInstanceOf(StoreAccessError);
  });

  it('treats an expired token as lost access', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 401 }));
    await expect(new GitHubStore(config).load()).rejects.toBeInstanceOf(StoreAccessError);
  });

  it('does not mistake rate limiting for lost access', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 403, headers: { 'X-RateLimit-Remaining': '0' } }));
    const failure = await new GitHubStore(config).load().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(StoreAccessError);
  });

  it('keeps both of two simultaneous bookings that do not clash', async () => {
    const server = fakeGitHub([]);
    const first = new GitHubStore(config);
    const second = new GitHubStore(config);
    await Promise.all([
      first.mutate((items) => addBooking(items, booking('a', 9, 10)), 'a'),
      second.mutate((items) => addBooking(items, booking('b', 11, 12)), 'b'),
    ]);
    expect(server.bookings.map((item) => item.id).sort()).toEqual(['a', 'b']);
  });

  it('lets only one of two simultaneous clashing bookings through', async () => {
    const server = fakeGitHub([]);
    const stores = [new GitHubStore(config), new GitHubStore(config)];
    const results = await Promise.allSettled(
      stores.map((store, index) => store.mutate((items) => addBooking(items, booking(`b${index}`, 13, 15)), 'book')),
    );
    expect(server.bookings).toHaveLength(1);
    const rejected = results.filter((result) => result.status === 'rejected') as PromiseRejectedResult[];
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictError);
  });
});
