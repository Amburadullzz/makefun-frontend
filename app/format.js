// Formatting: money, counts, clocks and dates, each one used by every view so a
// number looks the same on the board, the bounty page and the leaderboard.

const USD0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const USD2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const INT = new Intl.NumberFormat('en-US');
const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const DAY_ONLY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const CLOCK = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' });

/** Text made safe to put inside HTML, including attribute values. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A dollar amount: '719.00' -> '$719', '0.50' -> '$0.50', 1325 -> '$1,325'. */
export function usd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return (Math.round(n * 100) % 100 === 0 ? USD0 : USD2).format(n);
}

/** A whole number with thousands separators. */
export const num = (value) => INT.format(Number(value) || 0);

/** A count short enough for a stat cell: 12447 -> '12.4k', 969 -> '969'. */
export function compact(value) {
  const n = Number(value) || 0;
  if (n < 10000) return INT.format(n);
  if (n < 1000000) return `${(n / 1000).toFixed(n < 100000 ? 1 : 0)}k`;
  return `${(n / 1000000).toFixed(1)}M`;
}

/** The API's micro-units (950587 = 0.950587) as a rate: '95.06%'. */
export function pct(micro) {
  const n = Number(micro);
  if (!Number.isFinite(n)) return '—';
  return `${(n / 10000).toFixed(2)}%`;
}

/** A rate's 90% interval, low to high: '93.21 – 96.91'. */
export function interval(low, high) {
  if (!Number.isFinite(Number(low)) || !Number.isFinite(Number(high))) return '—';
  return `${(Number(low) / 10000).toFixed(2)} – ${(Number(high) / 10000).toFixed(2)}`;
}

/**
 * The time until a deadline: { ms, label, over, soon }.
 * 'closed' once it passes, '<1m', '35m', '5h 12m', '2d 4h'.
 */
export function until(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return { ms: 0, label: '—', over: true, soon: false };
  if (ms <= 0) return { ms, label: 'closed', over: true, soon: false };
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const label = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m` : '<1m';
  return { ms, label, over: false, soon: ms < 86400000 };
}

/** A deadline in UTC: 'Tue 17 Nov · 12:30 UTC'. */
export function utc(iso) {
  const d = new Date(iso);
  return `${DAY.format(d)} · ${CLOCK.format(d)} UTC`;
}

/** A deadline without the weekday, for a dense row: '17 Nov 12:30 UTC'. */
export function utcShort(iso) {
  const d = new Date(iso);
  return `${DAY_ONLY.format(d).replace(/ \d{4}$/, '')} ${CLOCK.format(d)} UTC`;
}

/** A day without a clock: '17 Nov 2026'. */
export const day = (iso) => DAY_ONLY.format(new Date(iso));

/** A path the API answered with, made absolute on make.fun; an absolute URL is left alone. */
export const onMakeFun = (path) => {
  if (!path) return '';
  return /^https?:\/\//i.test(path) ? path : `https://make.fun${path}`;
};

/** '1 entry' / '4 entries'. */
export const plural = (n, one, many) => `${num(n)} ${Number(n) === 1 ? one : many}`;
