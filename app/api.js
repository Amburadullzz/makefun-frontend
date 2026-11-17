// make.fun's public API, read-only over GET, through one cache: an answer is reused
// for FRESH_MS, concurrent calls for the same path share one request (inflight), and
// the board's answer is shared by the board and the live table.
//
// If-None-Match is deliberately not used: the API answers a conditional request with
// a 304 that carries no Access-Control-Allow-Origin, and a browser refuses that.

const API = 'https://make.fun/api';

/** How long an answer is reused before the API is asked again. */
const FRESH_MS = 45000;

const cache = new Map(); // path -> { at, body }
const inflight = new Map(); // path -> Promise, so two views of one page are one request

/** One fetch, retried when the connection itself failed (never on an HTTP error). */
async function send(path) {
  const init = { mode: 'cors', credentials: 'omit' };
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetch(API + path, init);
    } catch (error) {
      if (attempt >= 2) throw error;
      await new Promise((done) => setTimeout(done, 400 * (attempt + 1)));
    }
  }
}

async function getJSON(path) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.body;

  const running = inflight.get(path);
  if (running) return running;

  const request = (async () => {
    let res;
    try {
      res = await send(path);
    } catch (error) {
      // The connection is gone: an answer from a minute ago beats an empty page.
      if (hit) return hit.body;
      throw error;
    }
    if (!res.ok) {
      if (hit) return hit.body;
      throw new Error(`make.fun API answered ${res.status} for ${path}`);
    }
    const body = await res.json();
    cache.set(path, { at: Date.now(), body });
    return body;
  })();

  inflight.set(path, request);
  try {
    return await request;
  } finally {
    inflight.delete(path);
  }
}

/** The board: every open bounty with its pot, fee, entries and deadline. */
export const getBoard = () => getJSON('/competitions?status=open&activity=times&limit=50');

/** One bounty, with its rules, rewards table and dates (its entries list left out). */
export const getBounty = (slug) => getJSON(`/competitions/${encodeURIComponent(slug)}?submissions=summary`);

/**
 * A bounty's leaderboard: the ranked head and the rest of the field, in one answer.
 * The API has no page size of its own — rows=all sends the same field with the head
 * merged in, so `rows=first` is the smaller of the two and the only one used: the
 * table pages through the field it already holds instead of asking again.
 */
export const getLeaderboard = (slug) =>
  getJSON(`/competitions/${encodeURIComponent(slug)}/leaderboard?rows=first`);

/** An account's public profile: its record, links and solutions. */
export const getProfile = (handle) => getJSON(`/profiles/${encodeURIComponent(handle)}`);

/** Drop every cached answer, for a reader who asks for fresh numbers. */
export function forgetAll() {
  cache.clear();
}
