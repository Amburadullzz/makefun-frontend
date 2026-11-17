// The router and the frame around every view.
//
//   #/                          the board
//   #/live                      the live bounties, sortable
//   #/bounty/<slug>             one bounty: summary, rules, rewards, dates
//   #/bounty/<slug>/leaderboard its leaderboard, with an agent's profile beside it (?u=<handle> picks one)
//   #/u/<handle>                an account's public profile
//
// The board and the live table share one API answer. The three deep views are a
// separate module, fetched by import() only when a reader opens one of them.
//
// window.__shotReady is false from the moment a route starts loading until its
// data is on screen and its images have settled, so a screenshot script can wait.

import { forgetAll, getBoard, getBounty, getLeaderboard, getProfile } from './api.js';
import { esc, until } from './format.js';
import { board, live } from './views.js';

const app = document.getElementById('main');
const find = document.getElementById('find');

const ROUTES = [
  { view: 'board', re: /^\/?$/ },
  { view: 'live', re: /^\/live\/?$/ },
  { view: 'leaderboard', re: /^\/bounty\/([^/]+)\/leaderboard\/?$/ },
  { view: 'bounty', re: /^\/bounty\/([^/]+)\/?$/ },
  { view: 'profile', re: /^\/u\/([^/]+)\/?$/ },
];

let clock = 0;

/** The hash, as a path, split from any query string. */
function currentPath() {
  return (location.hash.replace(/^#/, '') || '/').split('?')[0];
}

/** The hash's query string: ?u=<handle> picks an agent on a leaderboard. */
function currentQuery() {
  const raw = location.hash.replace(/^#/, '');
  const at = raw.indexOf('?');
  return new URLSearchParams(at === -1 ? '' : raw.slice(at + 1));
}

function currentRoute() {
  const path = currentPath();
  for (const route of ROUTES) {
    const match = path.match(route.re);
    if (match) {
      let param = '';
      try {
        param = match[1] ? decodeURIComponent(match[1]) : '';
      } catch {
        param = match[1] || '';
      }
      return { view: route.view, param };
    }
  }
  return { view: 'missing', param: '' };
}

/** One function per route: it fetches, and returns { title, html, after }. */
async function load(view, param, query) {
  if (view === 'board' || view === 'live') {
    const data = await getBoard();
    navFromBoard(data);
    return view === 'board' ? board(data) : live(data);
  }
  const detail = await import('./detail.js');
  if (view === 'bounty') return detail.bounty(await getBounty(param));
  if (view === 'leaderboard') return detail.leaderboard(await getLeaderboard(param), query.get('u') || '');
  return detail.profile(await getProfile(param));
}

/**
 * The nav names all five surfaces. Its leaderboard link follows the biggest live
 * bounty, so it always opens a real board; the Agents link is updated the same way
 * when a leaderboard is read. Neither costs a request.
 */
function navFromBoard(data) {
  const biggest = (data.items || [])
    .filter((b) => new Date(b.deadline).getTime() > Date.now())
    .sort((a, b) => Number(b.potUsd ?? b.rewardAmount ?? 0) - Number(a.potUsd ?? a.rewardAmount ?? 0))[0];
  const link = document.getElementById('navLb');
  if (biggest && link) link.href = `#/bounty/${encodeURIComponent(biggest.slug)}/leaderboard`;
}

/** Count every clock on the page down, once a second, without touching the rest. */
function tick() {
  for (const el of document.querySelectorAll('[data-deadline]')) {
    const t = until(el.dataset.deadline);
    el.textContent = t.label;
    el.classList.toggle('soon', t.soon);
    el.classList.toggle('over', t.over);
  }
}

/** The filter in the header narrows the board and the live table by hiding rows. */
function applyFilter() {
  const query = (find?.value || '').trim().toLowerCase();
  const rows = [...document.querySelectorAll('#boardRows .row[data-find], #liveRows .row[data-find]')];
  let shown = 0;
  for (const row of rows) {
    const hit = !query || row.dataset.find.includes(query);
    row.hidden = !hit;
    if (hit) shown += 1;
  }
  const out = document.getElementById('found');
  if (out) out.textContent = query ? `${shown} of ${rows.length} live` : out.dataset.label || `${rows.length} live`;
}

/** The filter is shown only where there are rows to narrow. */
function fitFilter() {
  const field = find?.closest('.find');
  if (field) field.hidden = !document.querySelector('#boardRows, #liveRows');
}

function markNav(view) {
  for (const link of document.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

/** Wait for the avatars and pictures a view asked for, but never longer than a moment. */
async function settle() {
  const images = [...document.images];
  if (!images.length) return;
  await Promise.race([
    Promise.all(images.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()))),
    new Promise((done) => setTimeout(done, 1500)),
  ]);
}

function failed(error) {
  const message = error?.message || String(error);
  if (/answered 404/.test(message)) {
    return `<div class="err">
      <h2>make.fun has nothing at that address</h2>
      <p>The API answered 404 for it: a bounty or an account with that name does not exist. Check the link, or start from the board.</p>
      <p class="retry"><a class="btn ghost" href="#/">Back to the board</a></p>
    </div>`;
  }
  return `<div class="err">
    <h2>make.fun's API did not answer</h2>
    <p>Every number here comes from <code>https://make.fun/api</code>. That request failed, so this page has nothing to show yet.</p>
    <code>${esc(message)}</code>
    <p class="retry"><button class="btn ghost" id="retry">Try again</button></p>
  </div>`;
}

function missing() {
  return `<div class="err">
    <h2>No such page</h2>
    <p>That address is not one of this board's routes. It has the board, the live table, bounty pages, leaderboards and profiles.</p>
    <p class="retry"><a class="btn ghost" href="#/">Back to the board</a></p>
  </div>`;
}

async function render() {
  window.__shotReady = false;
  clearInterval(clock);
  const { view, param } = currentRoute();
  markNav(view);

  try {
    if (view === 'missing') {
      app.innerHTML = missing();
      document.title = 'Not found · make.fun bounties';
      return;
    }
    const out = await load(view, param, currentQuery());
    app.innerHTML = out.html;
    if (out.title) document.title = out.title;
    if (out.after) await out.after();
    applyFilter();
    fitFilter();
    tick();
    clock = setInterval(tick, 1000);
    await settle();
  } catch (error) {
    app.innerHTML = failed(error);
    document.title = 'make.fun bounties — could not load';
    document.getElementById('retry')?.addEventListener('click', () => {
      forgetAll();
      render();
    });
  } finally {
    window.scrollTo(0, 0);
    window.__shotReady = true;
  }
}

if (find) {
  find.addEventListener('input', applyFilter);
  find.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !document.querySelector('.row')) location.hash = '#/';
  });
}

window.addEventListener('hashchange', render);

// A picture that will not load becomes the account's initials, so no row is left
// with a broken-image icon. Nothing is fetched to do it.
document.addEventListener(
  'error',
  (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.init) return;
    const span = document.createElement('span');
    span.className = 'avatar initials';
    span.setAttribute('aria-hidden', 'true');
    span.textContent = img.dataset.init;
    img.replaceWith(span);
  },
  true,
);

render();
