# screen-yield

A cinema revenue-management platform: an interactive auditorium seat map, priced live by a
demand-based dynamic pricing engine, with a full breakdown of every multiplier that fired —
the same kind of yield-management math airlines and Ticketmaster-style event pricing run,
applied to a movie theater, with nothing hidden.

**Live demo:** [screen-yield-web.vercel.app](https://screen-yield-web.vercel.app/)

**Status: early build (M3 of 6).** The pricing engine, seat-map schema, a TMDB-driven
showtime schedule, and a live demo against one authored auditorium are done and tested. The
web app also has a real landing page (browse what's showing, click into a film) with
URL-based routing, and a client-side simulated seat-hold + checkout flow — clearly labeled
as a preview, not the real Postgres-backed M4 backend. There is no backend yet — see
[Roadmap](#roadmap). This README will grow into the full writeup (architecture, honest
counterfactual results) as those milestones land.

## What's real right now

- **`packages/pricing`** — a pure, dependency-free TypeScript pricing engine. No backend,
  no I/O, no clock read internally: identical inputs always produce an identical price
  breakdown. That purity is what lets the exact same function price seats in the browser
  today and, once a backend exists, be the function that actually charges the card.
- **`packages/schema`** — zod schemas for auditorium layouts and the film/showtime catalog,
  shared so a layout or snapshot that doesn't validate fails loudly instead of rendering
  wrong.
- **`packages/layouts`** — one hand-authored, fictional 154-seat IMAX hall
  ("Meridian Cinemas"), generated from a small parametric script rather than typed out by
  hand seat-by-seat (see `packages/layouts/generate-hall.mjs`).
- **`apps/etl`** — fetches now-playing/upcoming films from TMDB and allocates them into
  Meridian's showtime grid with a weighted round-robin scheduler (the same algorithm
  nginx uses to spread load across weighted backends) — popular titles get proportionally
  more slots, packed back-to-back on a quarter-hour grid with no double-booking. Runs
  daily on a GitHub Actions cron ([`ingest.yml`](.github/workflows/ingest.yml)) and
  commits the result to `packages/snapshot`.
- **`packages/snapshot`** — the committed output of the last ingest run: this week's real
  films and showtimes. `apps/web` reads these directly, so the demo stays fully
  interactive even with the backend (once one exists) completely asleep.
- **`apps/web`** — a React + Vite + Tailwind demo: browse what's currently showing on a
  landing page, click into a film to see its live-priced seat map, click or
  keyboard-navigate the seats, see the price and its full "receipts" breakdown, and drag
  the occupancy / demand sliders to watch the price move — including the moment the ceiling
  caps it. Selecting a seat starts a 90-second simulated hold (countdown, confirm/cancel,
  auto-release on expiry) — a client-side preview of what M4's real seat-holding will feel
  like, explicitly labeled as simulated in the UI.

## The pricing model

Every seat's price is:

```
zone_base   = base_price × ZONE_MULT[zone]                    // STANDARD 1.00, PREMIUM 1.25, RECLINER 1.40
surcharge   = FORMAT_SURCHARGE[format]                         // IMAX +$6, DOLBY +$4, 70MM +$5
m_occ       = 1 + 0.60 · occupancy^2.5                         // convex — flat until ~50% full, then bites
m_time      = 1 + 0.35 · exp(−hours_to_show / 48)              // the booking-curve premium for late buyers
m_release   = 1 + 0.25 · exp(−days_since_release / 14)         // opening-week premium, decayed by day 30
m_dow       = DOW_SLOT_MULT[day][slot]                         // 0.80 (Tue matinee) … 1.25 (Fri/Sat prime)
m_vel       = 1 + 0.15 · clamp(recent_rate/base_rate − 1, 0, 2) // real-time "everyone is booking this" surge

price = round_to_25c( clamp(
  (zone_base + surcharge) · m_occ · m_time · m_release · m_dow · m_vel,
  0.70 × (zone_base + surcharge),
  2.75 × (zone_base + surcharge),
) )
```

For a real showtime, `hours_to_show`, `days_since_release`, and `day`/`slot` are all
derived from the showtime's actual scheduled instant and the film's actual release date —
not simulated. Only occupancy and demand velocity are still slider-driven; those become
a real seeded simulation in M5.

Worked example (still reproduced exactly, independent of live data): a $12 IMAX seat,
Friday 7pm, 72% sold, 6 hours out, day 4 of release, demand running 1.8× baseline, prices
at **$49.50 — the ceiling binding**. See
[`packages/pricing/test/engine.test.ts`](packages/pricing/test/engine.test.ts).

Six invariants are enforced by property-based tests (`fast-check`) over the full input
domain, not just example cases — the price is always inside its own floor/ceiling, always a
positive integer number of cents, always deterministic, monotonic in occupancy, and its
factors always multiply back to the raw price. One of those invariants — never breaching the
floor or ceiling — turned out to be genuinely non-trivial: naive cents-rounding can walk a
clamped price back outside its own bounds by up to ~13¢. See the comment above the fix in
[`engine.ts`](packages/pricing/src/engine.ts).

## Running it locally

```bash
npm install
npm run build --workspace=@screen-yield/pricing
npm run build --workspace=@screen-yield/schema
npm run dev
```

Then open the printed local URL. `npm test` runs every workspace's test suite;
`npm run typecheck` typechecks all of them.

To pull real TMDB data (optional — `packages/snapshot` already ships with whatever the
last ingest run produced): copy `apps/etl/.env.example` to `apps/etl/.env`, add a free
[TMDB API key](https://www.themoviedb.org/settings/api), then
`npm run ingest --workspace=@screen-yield/etl`.

## Roadmap

- [x] **M1** — pricing engine + one live-priced auditorium, deployed
- [ ] **M2** — full seat-map polish: all Meridian halls, ADA-aware keyboard grid hardening
- [x] **M3** — TMDB ingestion + a generated weekly showtime schedule, on a GitHub Actions cron
- [ ] **M4** — a real backend: Postgres-backed seat holds, proven oversell-proof under
      concurrent load
- [ ] **M5** — a seeded demand simulator and a static-vs-dynamic pricing counterfactual,
      reported honestly (including where dynamic pricing costs occupancy)
- [ ] **M6** — the full writeup: architecture, the counterfactual results, tradeoffs

## Data & attribution

Film data comes from [TMDB](https://www.themoviedb.org/). This product uses TMDB and the
TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.

TMDB's terms forbid caching their data for longer than 6 months and forbid redistributing
it as a dataset. In practice that shapes the design, not just a footnote: `apps/etl`
fetches and stores only the minimal fields the app displays (title, release date,
runtime, popularity, and TMDB's own `poster_path` string — never a downloaded poster
image; posters are hotlinked live from `image.tmdb.org`), the ingest cron re-fetches
daily, and CI fails the build if the committed snapshot hasn't been refreshed in 90 days
([`check-snapshot-staleness.mjs`](.github/scripts/check-snapshot-staleness.mjs)) — a wide
margin before the 6-month limit, but tight enough to catch a dead cron early. That
staleness check exists because of a real failure mode: GitHub disables a _scheduled_
workflow after 60 days of repository inactivity, which is exactly what would eventually
happen here if the daily ingest commit ever stopped landing.

Theaters, halls, and showtimes are entirely fictional (Meridian Cinemas) — no real
chain's booking system is scraped or modeled.

## License

MIT — see [LICENSE](LICENSE).
