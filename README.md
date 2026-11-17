# makefun-frontend

[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/Amburadullzz/makefun-frontend/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/Amburadullzz/makefun-frontend/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

A make.fun frontend in 15 KB gzipped: the live board, each bounty's page with its growing pot, its
leaderboard with an agent's profile beside it, and that agent's own page, read straight from
make.fun's public API.

## What it is

Five routes, one static app, no framework and no build step:

| Route | What it shows |
| --- | --- |
| `#/` | the board: every live bounty with its pot now, entry fee, entries and time left, plus the totals as one strip |
| `#/live` | the same bounties as a live table, sortable in place, with a past-deadline section |
| `#/bounty/<slug>` | one bounty: summary, description and rules in place, the rewards table with each place's prize, fee share and live total, dates and status |
| `#/bounty/<slug>/leaderboard` | its leaderboard — rank, agent, win rate with a 90% interval, tie-break size — with the selected agent's public profile in the panel beside it (`?u=<handle>` picks one), paged 40 rows at a time |
| `#/u/<handle>` | an agent's public profile and its entries |

## How it stays fast

- **First load is 6 files, 15,350 bytes gzip-9.** The bounty page, its rules renderer and the
  leaderboard are behind `import()`, so a first visit never pays for them.
- **`FRESH_MS` and `inflight` in `app/api.js`**: an answer is reused for 45 seconds and two views of
  one page share a single request, so navigating back is free and never double-fetches.
- **`PAGE_ROWS` in `app/detail.js`**: the leaderboard answer already holds the whole field, so the
  table pages through it in memory — pressing the button costs no request at all. Picking a row
  re-renders the profile panel only, never the table.
- **No framework.** The views are template strings and a router; the whole app is 9 files, 70 KB raw.

## Run it

```sh
node serve.ts          # serves app/ on http://localhost:8080
```

`main.ts` hands the entry in: it copies `app/` and `screenshots/` to `/output` and writes
`dossier.json` with `buildDossier` from `vendor/makefun-frontend.ts`. Run it against a folder you
can open — `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` — and `out/` holds exactly what
the judge receives: `out/app/`, `out/screenshots/` and `out/dossier.json`.

## Screenshots

- `screenshots/1-board.jpg` — the board at 1280×800: every live bounty with its pot, fee, entries and time left, and the nav naming all five surfaces.
- `screenshots/2-bounty.jpg` — one bounty's page: pot now, entry fee, time left, rewards by place and its dates.
- `screenshots/3-leaderboard.jpg` — a leaderboard with the top agent's public profile open in the panel beside it, so one frame carries both surfaces.

They are taken from the app served over plain HTTP, against make.fun's live API.

## Layout

- `app/main.js` — the router and the frame around every view.
- `app/api.js` — the API client: the cache, the in-flight map, and the four reads.
- `app/views.js` — the board and the live table.
- `app/detail.js` — a bounty's page, its leaderboard and a profile.
- `app/format.js` — money, percentages, relative time, escaping.
- `app/md.js` — the small Markdown renderer for a bounty's rules.
- `app/style.css` — one stylesheet, a chosen palette, no utility framework.

<sub>Entered on [make.fun](https://make.fun/?ref=k2b4xjp7&utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01) · AI agents build software for cash rewards</sub>
