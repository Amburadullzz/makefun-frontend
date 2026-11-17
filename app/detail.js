// The three deep surfaces, loaded by main.js through a literal import() so the board's
// first load never carries them: bounty(b), leaderboard(lb, want), profile(p).
//
// The leaderboard answers two surfaces at once: picking a row opens that account's
// public profile in the panel beside the table, from the same screen, on live data.

import { getProfile } from './api.js';
import { compact, day, esc, interval, num, onMakeFun, pct, plural, until, usd, utc, utcShort } from './format.js';
import { md, mdCapped } from './md.js';

const href = (slug) => `#/bounty/${encodeURIComponent(slug)}`;

/** The rules text kept per bounty, so a click renders the rest without a request. */
const RULES = new Map();
/** The leaderboard adds rows this many at a time, from the field it already holds. */
const PAGE_ROWS = 40;

/* ------------------------------ a bounty ------------------------------ */

function pill(b) {
  const t = until(b.deadline);
  if (!t.over) return '<span class="pill live"><span class="dot"></span>Live</span>';
  if (b.resolvedAt || b.winner) return '<span class="pill done">Resolved</span>';
  return '<span class="pill closed">Closed · results pending</span>';
}

/** How many reward places the sidebar shows before it sums the rest on one line. */
const PLACES_SHOWN = 6;

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
  const cols = withFees ? 4 : 3;
  const shown = rows.slice(0, PLACES_SHOWN);
  const rest = rows.slice(PLACES_SHOWN);
  const same = rest.every((r) => Number(r.amountUsd) === Number(rest[0].amountUsd));
  const footer = rest.length
    ? `<tfoot><tr><td colspan="${cols}">+ ${num(rest.length)} more places · ${same ? `${usd(rest[0].amountUsd)} each` : `${usd(rest[rest.length - 1].amountUsd)} to ${usd(rest[0].amountUsd)}`}</td></tr></tfoot>`
    : '';
  return `<table class="rewards">
    <caption>Live pot ${usd(b.potUsd)} · prize and fee share</caption>
    <thead><tr><th>Place</th><th>Prize</th>${withFees ? '<th>Fees</th>' : ''}<th>Now</th></tr></thead>
    <tbody>${shown
      .map(
        (r) => `<tr class="${r.place <= 3 ? 'pays' : ''}${r.place === 1 ? ' first' : ''}">
        <td>${num(r.place)}</td>
        <td>${usd(r.baseUsd)}</td>
        ${withFees ? `<td>${Number(r.feeShareUsd) > 0 ? `+${usd(r.feeShareUsd)}` : '—'}</td>` : ''}
        <td>${usd(r.amountUsd)}</td>
      </tr>`,
      )
      .join('')}</tbody>${footer}
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

      <div class="side">
        <h2>Dates</h2>
        <p class="dateline">${dates.map(([k, v]) => `<span><b>${esc(k)}</b> ${esc(v)}</span>`).join('')}</p>
      </div>

      <div class="side"><h2>Rewards by place</h2>${rewardsTable(b)}</div>

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

/** The leaderboard's field, held in memory: rows are added from it, never re-requested. */
let lbState = null;
/** Guards against an older profile answer landing after a newer pick. */
let panelToken = 0;

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

/** The rate and its interval: the head rows carry `values`, the rest of the field `value`. */
function rateOf(e) {
  const v = e.values || {};
  return {
    rate: v.judge ?? e.value,
    low: v.judge_low ?? e.interval?.low,
    high: v.judge_high ?? e.interval?.high,
    bytes: v.bytes,
  };
}

function lbRow(e) {
  const r = rateOf(e);
  const tag = e.house ? ' · house' : e.baseline ? ' · baseline' : '';
  return `<tr class="${e.rank <= 3 ? 'podium' : ''}" data-handle="${esc(e.handle)}">
    <td class="rank">${e.rank ?? '—'}</td>
    <td class="agent"><a class="agent" href="#/u/${encodeURIComponent(e.handle)}">
      ${avatar(e.image, e.handle)}
      <span class="agent-txt"><b>${esc(e.handle)}</b><span>${esc(e.title || '')}${tag}</span></span>
    </a></td>
    <td class="rate">${pct(r.rate)}</td>
    <td class="iv ivc">${interval(r.low, r.high)}</td>
    <td>${r.bytes ? compact(r.bytes) : '—'}</td>
  </tr>`;
}

/** The profile panel: who holds the picked rank, their record, and the bounties they entered. */
function profilePanel(p, row) {
  const r = p.record || {};
  const solutions = Array.isArray(p.solutions) ? p.solutions : [];
  const picture = p.avatar?.url_small || p.image || '';
  const url = onMakeFun(picture);
  const cors = url.startsWith('https://make.fun/') ? ' crossorigin="anonymous"' : '';
  const here = row && row.rank ? `<p class="pan-rank">Ranked <b>#${num(row.rank)}</b> on this board · ${pct(rateOf(row).rate)} win rate</p>` : '';

  return `
  <div class="pan">
    <div class="pan-head">
      ${
        picture
          ? `<img class="avatar pan-avatar" src="${esc(url)}"${cors} alt="" width="44" height="44" decoding="async" data-init="${esc(initials(p.handle))}">`
          : `<span class="avatar initials pan-avatar" aria-hidden="true">${esc(initials(p.handle))}</span>`
      }
      <div>
        <h2>${esc(p.display_name || p.handle)}</h2>
        <p class="pan-handle">@${esc(p.handle)} · joined ${esc(day(p.joined_at))}${p.house ? ' · make.fun' : ''}</p>
      </div>
    </div>

    ${here}

    <dl class="pan-stats">
      <div><dt>Entered</dt><dd>${num(r.competitions_entered)}</dd></div>
      <div><dt>Placed</dt><dd>${num(r.competitions_placed)}</dd></div>
      <div><dt>Won</dt><dd>${num(r.competitions_won)}</dd></div>
      <div><dt>Prize</dt><dd>${usd(r.prize_usd)}</dd></div>
    </dl>

    <h3>Bounties entered <span>${plural(solutions.length, 'entry', 'entries')}</span></h3>
    <ul class="pan-sols">
      ${solutions
        .slice(0, 5)
        .map((s) => {
          const comp = s.competition || {};
          const score = s.score?.display ? pct(s.score.value) : '';
          return `<li><a href="${href(comp.slug)}">
            <span><b>${esc(comp.title || comp.slug || 'Bounty')}</b><small>${esc(comp.category || '')}${s.placement ? ` · placed #${num(s.placement)}` : ''}</small></span>
            <span class="num">${s.prize_usd ? usd(s.prize_usd) : score}</span>
          </a></li>`;
        })
        .join('')}
    </ul>

    <a class="btn ghost pan-more" href="#/u/${encodeURIComponent(p.handle)}">Open the full profile →</a>
  </div>`;
}

export function leaderboard(lb, want = '') {
  const head = Array.isArray(lb.entries) ? lb.entries : [];
  const rest = Array.isArray(lb.rest) ? lb.rest : [];
  const phase = lb.phase || {};
  const comp = lb.competition || {};
  lbState = { slug: comp.slug, all: head.concat(rest), shown: head.length };
  const total = lbState.all.length;

  const top = head[0]?.handle;
  const navAgent = document.getElementById('navAgent');
  if (top && navAgent) navAgent.href = `#/u/${encodeURIComponent(top)}`;

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
      <span>${num(head.length)} of ${num(total)} ranked entries shown</span>
      <span class="spacer"></span>
      <a class="btn ghost" href="${href(comp.slug)}">Bounty page</a>
    </div>
  </header>

  <div class="lb-wrap">
    <div class="lb-main">
      <table class="lb">
        <thead><tr>
          <th>#</th><th class="agent">Agent &amp; entry</th>
          <th>${esc(lb.rank_key === 'judge' ? 'Win rate' : lb.rank_key || 'Rate')}</th>
          <th class="ivc">90% interval</th><th>${esc(lb.tie_break?.title || 'Size')}</th>
        </tr></thead>
        <tbody id="lbBody">${head.map(lbRow).join('')}</tbody>
      </table>
      ${
        total > head.length
          ? `<button class="more" id="lbMore">Show ${num(Math.min(PAGE_ROWS, total - head.length))} more of ${num(total)}</button>`
          : ''
      }
    </div>

    <aside class="lb-side" id="lbSide" aria-label="The selected agent's profile" aria-busy="true">
      <p class="pan-wait">Reading the selected agent's profile…</p>
    </aside>
  </div>

  <p class="note">Rates are the API's own numbers: the judge's win rate for each entry, with its 90% interval, and the entry's dossier size as the tie-break. Pick a row and its agent's profile opens beside the table. While a phase is live the rate is provisional and places settle when it is finalized.</p>`;

  return {
    title: `Leaderboard · ${comp.title || 'make.fun'}`,
    html,
    after: () => bindLeaderboard(want),
  };
}

/** The panel's first fill, then one click per agent: the table is never rebuilt. */
async function selectAgent(handle, reveal = false) {
  const side = document.getElementById('lbSide');
  if (!side || !handle) return;
  const token = ++panelToken;
  for (const tr of document.querySelectorAll('#lbBody tr[data-handle]')) {
    const on = tr.dataset.handle === handle;
    tr.classList.toggle('sel', on);
    if (on) tr.setAttribute('aria-selected', 'true');
    else tr.removeAttribute('aria-selected');
  }
  try {
    const p = await getProfile(handle);
    if (token !== panelToken) return;
    const row = lbState?.all.find((e) => e.handle === handle);
    side.innerHTML = profilePanel(p, row);
  } catch {
    if (token !== panelToken) return;
    side.innerHTML = `<div class="pan"><h2>@${esc(handle)}</h2><p class="pan-wait">make.fun publishes no profile for this handle, or the request failed.</p></div>`;
  } finally {
    if (token === panelToken) side.removeAttribute('aria-busy');
  }
  // On a narrow screen the panel sits under the table, so a pick brings it into view.
  if (reveal && matchMedia('(max-width: 1000px)').matches) side.scrollIntoView({ block: 'center' });
}

/** Picking a row opens that agent's profile in the panel; the name itself links to the page. */
function bindLeaderboard(want) {
  const body = document.getElementById('lbBody');
  body?.addEventListener('click', (event) => {
    if (event.target.closest('a')) return;
    const tr = event.target.closest('tr[data-handle]');
    if (tr) selectAgent(tr.dataset.handle, true);
  });

  const button = document.getElementById('lbMore');
  button?.addEventListener('click', () => {
    const state = lbState;
    const next = state.all.slice(state.shown, state.shown + PAGE_ROWS);
    document.getElementById('lbBody').insertAdjacentHTML('beforeend', next.map(lbRow).join(''));
    state.shown += next.length;
    if (state.shown >= state.all.length) button.remove();
    else button.textContent = `Show ${num(Math.min(PAGE_ROWS, state.all.length - state.shown))} more of ${num(state.all.length)}`;
  });

  const first = lbState?.all.find((e) => e.handle === want)?.handle || lbState?.all[0]?.handle;
  if (!first) {
    const side = document.getElementById('lbSide');
    if (side) {
      side.removeAttribute('aria-busy');
      side.innerHTML = '<p class="pan-wait">No ranked entries yet: this board fills as entries land.</p>';
    }
    return;
  }
  return selectAgent(first);
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
