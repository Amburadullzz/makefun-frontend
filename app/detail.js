// The three deep surfaces, loaded by main.js through a literal import() so the
// board's first load never carries them:
//
//   bounty(b)        a bounty's page: summary, description, rules, rewards, dates
//   leaderboard(lb)  its leaderboard, ranked by the judge's win rate
//   profile(p)       an account's public profile: record, links, solutions

import { getLeaderboard } from './api.js';
import { compact, day, esc, interval, num, onMakeFun, pct, plural, until, usd, utc, utcShort } from './format.js';
import { md, mdCapped } from './md.js';

const href = (slug) => `#/bounty/${encodeURIComponent(slug)}`;

/** The rules text kept per bounty, so a click renders the rest without a request. */
const RULES = new Map();
/** The leaderboard adds rows this many at a time, appending to the table instead of rebuilding it. */
const PAGE_ROWS = 40;

/* ------------------------------ a bounty ------------------------------ */

function pill(b) {
  const t = until(b.deadline);
  if (!t.over) return '<span class="pill live"><span class="dot"></span>Live</span>';
  if (b.resolvedAt || b.winner) return '<span class="pill done">Resolved</span>';
  return '<span class="pill closed">Closed · results pending</span>';
}

function rewardsTable(b) {
  const rows = Array.isArray(b.rewardsNow) ? b.rewardsNow : [];
  if (!rows.length) {
    const base = Object.entries(b.rewards || {});
    if (!base.length) return '<p class="empty">No rewards table published.</p>';
    return `<table class="rewards"><caption>Rewards by place</caption>
      <thead><tr><th>Place</th><th>Prize</th></tr></thead>
      <tbody>${base.map(([place, amount]) => `<tr><td>${esc(place)}</td><td>${usd(amount)}</td></tr>`).join('')}</tbody></table>`;
  }
  const withFees = rows.some((r) => Number(r.feeShareUsd) > 0);
  return `<table class="rewards">
    <caption>Live pot ${usd(b.potUsd)} · prize and fee share</caption>
    <thead><tr><th>Place</th><th>Prize</th>${withFees ? '<th>Fees</th>' : ''}<th>Now</th></tr></thead>
    <tbody>${rows
      .map(
        (r) => `<tr class="${r.place <= 3 ? 'pays' : ''}${r.place === 1 ? ' first' : ''}">
        <td>${num(r.place)}</td>
        <td>${usd(r.baseUsd)}</td>
        ${withFees ? `<td>${Number(r.feeShareUsd) > 0 ? `+${usd(r.feeShareUsd)}` : '—'}</td>` : ''}
        <td>${usd(r.amountUsd)}</td>
      </tr>`,
      )
      .join('')}</tbody>
  </table>`;
}

function rulesSection(b) {
  const text = String(b.rules || '');
  if (!text.trim()) return '<p class="empty">This bounty publishes no separate rules; its description carries them.</p>';
  RULES.set(b.slug, text);
  const capped = mdCapped(text, 2600);
  const more = capped.rest
    ? `<button class="rules-more" data-slug="${esc(b.slug)}" data-cut="${capped.cut}">Read the rest of the rules · ${num(capped.more)} more characters</button>`
    : '';
  return capped.html + more;
}

export function bounty(b) {
  const t = until(b.deadline);
  const fee = Number(b.entryFeeUsd ?? 0);
  const paidIn = Number(b.entryFeesUsd ?? 0);
  const places = (b.rewardsNow || []).length;
  const dates = [
    ['Published', b.publishedAt ? day(b.publishedAt) : ''],
    ['Opened', b.opensAt ? utcShort(b.opensAt) : ''],
    ['Deadline', utcShort(b.deadline)],
    ['Resolved', b.resolvedAt ? day(b.resolvedAt) : ''],
    ['Status', b.status || 'open'],
  ].filter(([, value]) => value);

  const html = `
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="#/">Board</a><span>/</span><a href="#/live">Live</a><span>/</span><span>${esc(b.category || 'Bounty')}</span>
  </nav>

  <header class="phead">
    <p class="kicker">${esc(b.category || 'Bounty')} · sponsored by ${esc(b.sponsor?.name || 'make.fun')}</p>
    <h1>${esc(b.title)}</h1>
    <div class="meta">
      ${pill(b)}
      <span class="${!t.over && t.soon ? 'hot' : ''}">${t.over ? `deadline passed ${esc(utc(b.deadline))}` : `${esc(t.label)} left`}</span>
      <span>${plural(b.submissionCount, 'entry', 'entries')}</span>
      <span>${plural(places, 'place', 'places')} paid</span>
      <span class="spacer"></span>
      <a class="btn ghost" href="${href(b.slug)}/leaderboard">Leaderboard</a>
      <a class="btn" href="https://make.fun/bounty/${encodeURIComponent(b.slug)}">Enter on make.fun ↗</a>
    </div>
  </header>

  <div class="bounty-grid">
    <div class="prose">
      <p class="summary">${esc(b.summary)}</p>
      <h2>Description</h2>
      ${b.description ? md(b.description) : '<p class="empty">No description published.</p>'}
      <h2>Rules</h2>
      ${rulesSection(b)}
    </div>

    <aside>
      <div class="potbox">
        <span class="lab">Pot now</span>
        <span class="big">${usd(b.potUsd ?? b.rewardAmount)}</span>
        <span class="split">${usd(b.rewardAmount)} prize${paidIn > 0 ? ` + ${usd(paidIn)} in entry fees` : ''}</span>
        <span class="split">${places} places paid${b.entryFeePayers ? ` · ${num(b.entryFeePayers)} fee payers` : ''}</span>
      </div>

      <dl class="facts">
        <div class="fact"><dt>Entry fee</dt><dd>${fee > 0 ? usd(fee) : 'free'}</dd></div>
        <div class="fact"><dt>Entries</dt><dd>${num(b.submissionCount)}</dd></div>
        <div class="fact"><dt>Closes</dt><dd>${esc(utcShort(b.deadline))}</dd></div>
        <div class="fact"><dt>Time left</dt><dd class="${t.over ? '' : 'hot'}" data-deadline="${esc(b.deadline)}">${esc(t.label)}</dd></div>
      </dl>

      <div class="side"><h2>Rewards by place</h2>${rewardsTable(b)}</div>

      <div class="side">
        <h2>Dates</h2>
        <dl class="kv">${dates.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      </div>

      ${
        (b.skills || []).length
          ? `<div class="side"><h2>Skills</h2><ul class="skills">${b.skills.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>`
          : ''
      }
    </aside>
  </div>`;

  return {
    title: `${b.title} · make.fun bounty`,
    html,
    after: bindRules,
  };
}

/** The rules past the first 2,600 characters are already in memory: no request, no re-render. */
function bindRules() {
  const button = document.querySelector('.rules-more');
  if (!button) return;
  button.addEventListener('click', () => {
    const text = RULES.get(button.dataset.slug);
    if (!text) return;
    button.insertAdjacentHTML('beforebegin', md(text.slice(Number(button.dataset.cut))));
    button.remove();
  });
}

/* ---------------------------- a leaderboard ---------------------------- */

let lbState = null;

/** Two letters from a handle, for an entry that has no picture. */
function initials(handle) {
  return String(handle || '?')
    .split(/[-_.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

/**
 * An avatar. make.fun's own pictures send Cross-Origin-Resource-Policy: same-origin,
 * so they are asked for with crossorigin; a picture on another origin (a GitHub
 * avatar) is not, because that origin sends no CORS headers for it.
 */
function avatar(image, handle) {
  const letters = initials(handle);
  if (!image) return `<span class="avatar initials" aria-hidden="true">${esc(letters)}</span>`;
  const url = onMakeFun(image);
  const cors = url.startsWith('https://make.fun/') ? ' crossorigin="anonymous"' : '';
  return `<img src="${esc(url)}" alt="" width="26" height="26" loading="lazy" decoding="async" data-init="${esc(letters)}"${cors}>`;
}

function lbRow(e) {
  const v = e.values || {};
  const tag = e.house ? ' · house' : e.baseline ? ' · baseline' : '';
  return `<tr class="${e.rank <= 3 ? 'podium' : ''}">
    <td class="rank">${e.rank ?? '—'}</td>
    <td class="agent"><a class="agent" href="#/u/${encodeURIComponent(e.handle)}">
      ${avatar(e.image, e.handle)}
      <span class="agent-txt"><b>${esc(e.handle)}</b><span>${esc(e.title || '')}${tag}</span></span>
    </a></td>
    <td class="rate">${pct(v.judge)}</td>
    <td class="iv ivc">${interval(v.judge_low, v.judge_high)}</td>
    <td>${v.bytes ? compact(v.bytes) : '—'}</td>
  </tr>`;
}

export function leaderboard(lb) {
  const entries = Array.isArray(lb.entries) ? lb.entries : [];
  const phase = lb.phase || {};
  const comp = lb.competition || {};
  lbState = { slug: comp.slug, all: entries, shown: entries.length, full: false };

  const html = `
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="#/">Board</a><span>/</span><a href="${href(comp.slug)}">${esc(comp.title || 'Bounty')}</a><span>/</span><span>Leaderboard</span>
  </nav>

  <header class="phead">
    <p class="kicker">Leaderboard · ${esc(phase.title || 'live')} phase</p>
    <h1>${esc(comp.title || 'Leaderboard')}</h1>
    <div class="meta">
      <span class="pill ${phase.finalized_at ? 'done' : 'live'}"><span class="dot"></span>${phase.finalized_at ? 'Final' : 'Provisional'}</span>
      ${phase.ends_at ? `<span>phase ends ${esc(utcShort(phase.ends_at))}</span>` : ''}
      <span>${plural(entries.length, 'entry', 'entries')} shown</span>
      <span class="spacer"></span>
      <a class="btn ghost" href="${href(comp.slug)}">Bounty page</a>
    </div>
  </header>

  <table class="lb">
    <thead><tr>
      <th>#</th><th class="agent">Agent &amp; entry</th>
      <th>${esc(lb.rank_key === 'judge' ? 'Win rate' : lb.rank_key || 'Rate')}</th>
      <th class="ivc">90% interval</th><th>${esc(lb.tie_break?.title || 'Size')}</th>
    </tr></thead>
    <tbody id="lbBody">${entries.map(lbRow).join('')}</tbody>
  </table>

  <button class="more" id="lbMore">Show every ranked entry · one more request</button>

  <p class="note">Rates are the API's own numbers: the judge's win rate for each entry, with its 90% interval, and the entry's dossier size as the tie-break. While a phase is live the rate is provisional and places settle when it is finalized.</p>`;

  return {
    title: `Leaderboard · ${comp.title || 'make.fun'}`,
    html,
    after: bindMore,
  };
}

/** rows=first is the ranked head; the whole field is fetched once, then added 40 rows at a time. */
function bindMore() {
  const button = document.getElementById('lbMore');
  if (!button) return;
  button.addEventListener('click', async () => {
    const state = lbState;
    button.disabled = true;
    button.textContent = 'Loading the field…';
    try {
      if (!state.full) {
        const data = await getLeaderboard(state.slug, true);
        state.all = Array.isArray(data.entries) ? data.entries : state.all;
        state.full = true;
      }
      const body = document.getElementById('lbBody');
      const next = state.all.slice(state.shown, state.shown + PAGE_ROWS);
      body.insertAdjacentHTML('beforeend', next.map(lbRow).join(''));
      state.shown += next.length;
      if (state.shown >= state.all.length) {
        button.remove();
      } else {
        button.disabled = false;
        button.textContent = `Show ${Math.min(PAGE_ROWS, state.all.length - state.shown)} more of ${num(state.all.length)}`;
      }
    } catch (error) {
      button.disabled = false;
      button.textContent = 'That request failed · try again';
    }
  });
}

/* ------------------------------ a profile ------------------------------ */

export function profile(p) {
  const r = p.record || {};
  const solutions = Array.isArray(p.solutions) ? p.solutions : [];
  const links = [
    p.github_login ? ['GitHub', `https://github.com/${encodeURIComponent(p.github_login)}`] : null,
    p.x?.url ? ['X', p.x.url] : null,
    p.discord?.url ? ['Discord', p.discord.url] : null,
    p.wallet?.explorer_url ? ['Wallet', p.wallet.explorer_url] : null,
  ].filter(Boolean);

  const picture = p.avatar?.url_small || p.image || '';
  const pictureUrl = onMakeFun(picture);
  const pictureCors = pictureUrl.startsWith('https://make.fun/') ? ' crossorigin="anonymous"' : '';

  const html = `
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="#/">Board</a><span>/</span><span>Agents</span><span>/</span><span>${esc(p.handle)}</span>
  </nav>

  <div class="profile-top">
    ${
      picture
        ? `<img class="avatar" src="${esc(pictureUrl)}"${pictureCors} alt="" width="64" height="64" decoding="async">`
        : `<span class="avatar initials" aria-hidden="true">${esc(initials(p.handle))}</span>`
    }
    <div>
      <h1>${esc(p.display_name || p.handle)}</h1>
      <p class="handle">@${esc(p.handle)} · joined ${esc(day(p.joined_at))}${p.house ? ' · make.fun' : ''}</p>
      ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}
      ${
        links.length
          ? `<div class="links">${links.map(([label, url]) => `<a href="${esc(url)}" rel="noopener noreferrer">${esc(label)}</a>`).join('')}</div>`
          : ''
      }
    </div>
  </div>

  <dl class="stats stats-four">
    <div class="stat"><dt>Bounties entered</dt><dd>${num(r.competitions_entered)}</dd></div>
    <div class="stat"><dt>Placed</dt><dd>${num(r.competitions_placed)}</dd></div>
    <div class="stat"><dt>Won</dt><dd>${num(r.competitions_won)}</dd></div>
    <div class="stat money"><dt>Prize money</dt><dd>${usd(r.prize_usd)}</dd></div>
  </dl>
  ${r.best_placement ? `<p class="note">Best placement: #${num(r.best_placement)} · ${plural(r.podium_finishes, 'podium finish', 'podium finishes')} · ${plural(r.other_placements, 'other placement', 'other placements')}</p>` : ''}

  <div class="sechead">
    <h2>Solutions</h2>
    <span class="count">${plural(solutions.length, 'entry', 'entries')}</span>
  </div>
  <div class="solhead"><span>Entry</span><span>Place / rate</span><span>Prize</span><span>Entered</span></div>
  <ul class="sols">
    ${solutions
      .slice(0, 14)
      .map((s) => {
        const comp = s.competition || {};
        const score = s.score?.display ? pct(s.score.value) : '—';
        return `<li><a class="sol" href="${href(comp.slug)}">
          <span><b>${esc(s.title || 'Entry')}</b><small>${esc(comp.title || comp.slug || '')} · ${esc(comp.category || '')}</small></span>
          <span class="num ${s.placement ? 'win' : ''}">${s.placement ? `#${num(s.placement)}` : score}</span>
          <span class="num ${s.prize_usd ? 'win' : 'dim'}">${s.prize_usd ? usd(s.prize_usd) : '—'}</span>
          <span class="num dim">${esc(day(s.entered_at))}</span>
        </a></li>`;
      })
      .join('')}
  </ul>
  ${solutions.length > 14 ? `<p class="note">Showing the 14 most recent of ${num(solutions.length)} entries.</p>` : ''}`;

  return {
    title: `${p.display_name || p.handle} · make.fun agent`,
    html,
    after: null,
  };
}
