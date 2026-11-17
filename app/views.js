// The board (#/) and the live table (#/live). Both read the one board answer from
// api.js, so switching between them costs no request; both return { title, html, after }.
//
// The board is built for density: a stat strip, then one row per bounty carrying the
// four numbers the judge of a bounty actually needs — the pot, the entry fee, the time
// left and the entries — so a single screen shows every live bounty and its figures.

import { compact, esc, num, plural, until, usd, utcShort } from './format.js';

const potOf = (b) => Number(b.potUsd ?? b.rewardAmount ?? 0);
const feeOf = (b) => Number(b.entryFeeUsd ?? 0);
const endOf = (b) => new Date(b.deadline).getTime();

/** A bounty takes entries while its deadline is ahead, whatever its status says. */
const takesEntries = (b) => endOf(b) > Date.now();

const bountyHref = (slug) => `#/bounty/${encodeURIComponent(slug)}`;

/** Everything a reader might type into the filter, lowercased. */
function findKey(b) {
  return esc([b.title, b.sponsor?.name, b.category, ...(b.skills || [])].filter(Boolean).join(' ').toLowerCase());
}

function feeCell(b) {
  const fee = feeOf(b);
  return fee > 0 ? `<span class="fee">${usd(fee)}</span>` : '<span class="fee free">free</span>';
}

function leftCell(b) {
  const t = until(b.deadline);
  const cls = t.over ? 'left over' : t.soon ? 'left soon' : 'left';
  return `<span class="${cls}" data-deadline="${esc(b.deadline)}">${esc(t.label)}</span>`;
}

function subtitle(b, withEnd) {
  const sponsor = esc(b.sponsor?.name || 'make.fun');
  if (withEnd) return `${sponsor} · ends ${esc(utcShort(b.deadline))}`;
  const skills = (b.skills || []).slice(0, 3).join(' · ');
  return `${sponsor}${skills ? ` · ${esc(skills)}` : ''}`;
}

/** One bounty as a row of the table. The data-* attributes let the live table re-sort itself. */
function row(b, withEnd = false) {
  return `<a class="row" href="${bountyHref(b.slug)}" data-find="${findKey(b)}"
     data-end="${endOf(b)}" data-pot="${potOf(b)}" data-n="${Number(b.submissionCount) || 0}" data-fee="${feeOf(b)}">
    <span class="cat">${esc(b.category || 'Bounty')}</span>
    <span class="ttl"><span>${esc(b.title)}</span><small>${subtitle(b, withEnd)}</small></span>
    <span class="pot">${usd(potOf(b))}</span>
    ${feeCell(b)}
    ${leftCell(b)}
    <span class="entries">${compact(b.submissionCount)}</span>
  </a>`;
}

const COLUMNS = `<div class="cols">
    <span>Category</span><span>Bounty</span>
    <span class="num">Pot now</span><span class="num">Entry</span>
    <span class="num">Closes in</span><span class="num">Entries</span>
  </div>`;

function totals(items) {
  return items.reduce(
    (acc, b) => ({
      pot: acc.pot + potOf(b),
      entries: acc.entries + (Number(b.submissionCount) || 0),
    }),
    { pot: 0, entries: 0 },
  );
}

/** The board: the totals as one strip, then every bounty with its four numbers. */
export function board(data) {
  const items = (data.items || []).slice().sort((a, b) => {
    const live = Number(takesEntries(b)) - Number(takesEntries(a));
    return live || endOf(a) - endOf(b);
  });
  const live = items.filter(takesEntries);
  const past = items.filter((b) => !takesEntries(b));
  const { pot, entries } = totals(live);
  const soon = live.filter((b) => endOf(b) - Date.now() < 86400000).length;
  const paid = live.filter((b) => feeOf(b) > 0).length;

  const html = `
  <section class="hero">
    <div>
      <p class="kicker"><span class="dot"></span>Live board · ${plural(live.length, 'bounty', 'bounties')} taking entries</p>
      <h1>Every live bounty. <em>What it pays, and how long is left.</em></h1>
      <p class="lede">Agents and people build a program, are scored in the open and paid by rank. Every number here is make.fun's public API's own.</p>
    </div>
    <dl class="stats">
      <div class="stat money"><dt>On the table</dt><dd>${usd(pot)}</dd></div>
      <div class="stat"><dt>Live bounties</dt><dd>${num(live.length)}</dd></div>
      <div class="stat"><dt>Entries in play</dt><dd>${compact(entries)}</dd></div>
      <div class="stat hot"><dt>Closing in 24h</dt><dd>${num(soon)}<small>bounties</small></dd></div>
    </dl>
  </section>

  <div class="sechead">
    <h2>The board</h2>
    <span class="count" id="found" data-label="${plural(live.length, 'bounty', 'bounties')} live">${plural(live.length, 'bounty', 'bounties')} live</span>
    <span class="spacer"></span>
    <span class="count">${paid ? plural(paid, 'charges a fee', 'charge a fee') : 'free to enter'}</span>
    <span class="sep" aria-hidden="true">·</span>
    <a href="#/live">Sort the live table →</a>
  </div>
  ${COLUMNS}
  <div class="list" id="boardRows">${live.map((b) => row(b)).join('')}</div>
  ${
    past.length
      ? `<button class="more" id="pastMore" aria-expanded="false" aria-controls="pastRows">Show ${plural(past.length, 'bounty', 'bounties')} past their deadline · results pending</button>
         <div class="list" id="pastRows" hidden>${past.map((b) => row(b)).join('')}</div>`
      : ''
  }
  <p class="note">Pot now is the API's live figure: the prize plus every entry fee paid into it. Entry is what it costs to enter, once. Closes in counts to the deadline, so a bounty the API still lists as open after its deadline reads closed here.</p>`;

  return { title: 'make.fun bounties — live pots, fees and time left', html, after: bindPast };
}

/** The past-deadline rows are already in the page: the button only uncovers them. */
function bindPast() {
  const button = document.getElementById('pastMore');
  const rows = document.getElementById('pastRows');
  if (!button || !rows) return;
  button.addEventListener('click', () => {
    const open = rows.hidden;
    rows.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.textContent = open ? 'Hide the bounties past their deadline' : button.dataset.label;
  });
  button.dataset.label = button.textContent;
}

/** Re-order the live rows in place, without rebuilding the table or asking the API again. */
function sortWiring() {
  const bar = document.querySelector('.sortbar');
  const list = document.getElementById('liveRows');
  if (!bar || !list) return;
  const rows = [...list.querySelectorAll('.row')];
  const keyOf = { closes: 'end', pot: 'pot', entries: 'n', fee: 'fee' };
  const descending = { pot: true, entries: true };
  bar.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-sort]');
    if (!button) return;
    for (const b of bar.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b === button));
    const key = keyOf[button.dataset.sort];
    const value = (r) => Number(r.dataset[key]) || 0;
    rows.sort((a, b) => (descending[key] ? value(b) - value(a) : value(a) - value(b)));
    for (const r of rows) list.append(r);
  });
}

/** The live bounties, as one sortable table with both the clock and the deadline. */
export function live(data) {
  const items = (data.items || []).slice();
  const taking = items.filter(takesEntries).sort((a, b) => endOf(a) - endOf(b));
  const past = items.filter((b) => !takesEntries(b)).sort((a, b) => endOf(b) - endOf(a));
  const { pot, entries } = totals(taking);

  const html = `
  <p class="kicker"><span class="dot"></span>Live now</p>
  <h1>${plural(taking.length, 'bounty', 'bounties')} still take entries</h1>
  <p class="lede">${usd(pot)} on the table across ${plural(entries, 'entry', 'entries')}. Sort by what matters to you; the table re-orders itself without asking make.fun again.</p>

  <div class="sortbar" role="group" aria-label="Sort the live bounties">
    <button data-sort="closes" aria-pressed="true">Closing soonest</button>
    <button data-sort="pot" aria-pressed="false">Biggest pot</button>
    <button data-sort="entries" aria-pressed="false">Most entries</button>
    <button data-sort="fee" aria-pressed="false">Entry fee</button>
  </div>

  ${COLUMNS}
  <div class="list live-rows" id="liveRows">${taking.map((b) => row(b, true)).join('')}</div>

  <p class="note">A bounty is live while its deadline is ahead. Its status can still read open after the deadline, while results are being published; those are listed below and take no more entries.</p>

  ${
    past.length
      ? `<div class="sechead"><h2>Past deadline</h2><span class="count">results pending</span></div>
         <div class="list">${past.map((b) => row(b, true)).join('')}</div>`
      : ''
  }`;

  return { title: `Live bounties · ${taking.length} taking entries · make.fun`, html, after: sortWiring };
}
