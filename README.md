# screen-yield

A cinema revenue-management platform: an interactive auditorium seat map, priced live by a
demand-based dynamic pricing engine, with a full breakdown of every multiplier that fired —
the same kind of yield-management math airlines and Ticketmaster-style event pricing run,
applied to a movie theater, with nothing hidden.

**Status: early build (M1 of 6).** The pricing engine, seat-map schema, and a live demo
against one authored auditorium are done and tested. There is no backend, no real showtime
data, and no seat-holding yet — see [Roadmap](#roadmap). This README will grow into the full
writeup (architecture, honest results) as those milestones land.

## What's real right now

- **`packages/pricing`** — a pure, dependency-free TypeScript pricing engine. No backend,
  no I/O, no clock read internally: identical inputs always produce an identical price
  breakdown. That purity is what lets the exact same function price seats in the browser
  today and, once a backend exists, be the function that actually charges the card.
- **`packages/schema`** — zod schemas for auditorium layouts, shared so a layout that
  doesn't validate fails loudly instead of rendering wrong.
- **`packages/layouts`** — one hand-authored, fictional 154-seat IMAX hall
  ("Meridian Cinemas"), generated from a small parametric script rather than typed out by
  hand seat-by-seat (see `packages/layouts/generate-hall.mjs`).
- **`apps/web`** — a React + Vite + Tailwind demo: click or keyboard-navigate the seat map,
  see the live price and its full "receipts" breakdown, and drag the occupancy / time /
  demand sliders to watch the price move — including the moment the ceiling caps it.

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

Worked example: a $12 IMAX seat, Friday 7pm, 72% sold, 6 hours out, day 4 of release, demand
running 1.8× baseline, prices at **$49.50 — the ceiling binding**. It's reproduced exactly in
[`packages/pricing/test/engine.test.ts`](packages/pricing/test/engine.test.ts) and live in the
demo (set Occupancy to 72%, Hours to showtime to 6, Demand velocity to 1.80x, and select any
standard seat).

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

## Roadmap

- [x] **M1** — pricing engine + one live-priced auditorium, deployed
- [ ] **M2** — full seat-map polish: all Meridian halls, ADA-aware keyboard grid hardening
- [ ] **M3** — TMDB ingestion + a generated weekly showtime schedule, on a GitHub Actions cron
- [ ] **M4** — a real backend: Postgres-backed seat holds, proven oversell-proof under
      concurrent load
- [ ] **M5** — a seeded demand simulator and a static-vs-dynamic pricing counterfactual,
      reported honestly (including where dynamic pricing costs occupancy)
- [ ] **M6** — the full writeup: architecture, the counterfactual results, tradeoffs

## Data & attribution

Film data (once M3 lands) comes from [TMDB](https://www.themoviedb.org/); this product uses
TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.
Theaters, halls, and showtimes are entirely fictional (Meridian Cinemas) — no real chain's
booking system is scraped or modeled.

## License

MIT — see [LICENSE](LICENSE).
