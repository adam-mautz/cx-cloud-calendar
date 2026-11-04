import { pruneOld } from '../conflicts';
import type { Booking, DataConfig } from '../types';
import { StoreAccessError, type BookingStore } from './types';

const MAX_ATTEMPTS = 6;

const NO_ACCESS = "The booking token can't reach the data repo. It may have expired.";

interface Snapshot {
  bookings: Booking[];
  sha: string;
}

function decode(content: string): Booking[] {
  const binary = atob(content.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { bookings?: Booking[] };
  return parsed.bookings ?? [];
}

function encode(bookings: Booking[]): string {
  const bytes = new TextEncoder().encode(`${JSON.stringify({ version: 1, bookings }, null, 2)}\n`);
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Keeps bookings in one JSON file in a private repo. Every save names the file
 * version it was based on, and GitHub rejects it if that version is stale. That
 * rejection is what makes two simultaneous bookings safe: the loser re-reads,
 * re-runs the conflict check, and then either saves or reports the clash.
 */
export class GitHubStore implements BookingStore {
  private etag: string | undefined;
  private readonly url: string;

  constructor(private readonly config: DataConfig) {
    this.url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`;
  }

  private headers(): HeadersInit {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.config.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  private async send(url: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch {
      throw new Error("Couldn't reach GitHub. Check your connection and try again.");
    }
    const rateLimited = response.status === 429 || response.headers.get('X-RateLimit-Remaining') === '0';
    if (rateLimited) throw new Error('GitHub is limiting requests. Try again in a few minutes.');
    // A private repo answers 404, not 403, to a token that can't see it. The file
    // always exists, so a 404 must never be read as "no bookings".
    if ([401, 403, 404].includes(response.status)) throw new StoreAccessError(NO_ACCESS);
    return response;
  }

  private async read(conditional: boolean): Promise<Snapshot | null> {
    const headers = new Headers(this.headers());
    if (conditional && this.etag) headers.set('If-None-Match', this.etag);
    // GitHub marks responses cacheable for 60s, which would hide fresh bookings.
    const response = await this.send(`${this.url}?ref=${this.config.branch}`, { headers, cache: 'no-store' });

    if (response.status === 304) return null;
    if (!response.ok) throw new Error(`Could not load bookings (${response.status}).`);

    this.etag = response.headers.get('ETag') ?? undefined;
    const file = (await response.json()) as { content: string; sha: string };
    return { bookings: decode(file.content), sha: file.sha };
  }

  async load(): Promise<Booking[] | null> {
    const snapshot = await this.read(true);
    return snapshot ? snapshot.bookings : null;
  }

  async mutate(apply: (bookings: Booking[]) => Booking[], message: string): Promise<Booking[]> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const snapshot = await this.read(false);
      if (!snapshot) throw new Error('Could not load bookings.');

      const bookings = pruneOld(apply(snapshot.bookings), new Date());
      const response = await this.send(this.url, {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify({
          message,
          content: encode(bookings),
          branch: this.config.branch,
          sha: snapshot.sha,
        }),
      });

      if (response.ok) {
        this.etag = undefined;
        return bookings;
      }
      if (response.status !== 409 && response.status !== 422) {
        throw new Error(`Could not save (${response.status}).`);
      }
      // Someone else saved first. Back off with jitter so retries don't collide again.
      await wait(150 * 2 ** attempt + Math.random() * 250);
    }
    throw new Error('The board is busy. Try again in a moment.');
  }
}
