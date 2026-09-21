import type { AuditoriumLayout, Film, Showtime } from "@screen-yield/schema";
import { addDays, formatHHMM, type LocalCalendarDate, zonedWallTimeToUtc } from "./timezone.js";

/** How many days ahead to generate — a rolling week, regenerated daily by ingest.yml so
 * "today" always has showtimes even as the window slides forward. */
export const DAYS_AHEAD = 7;
/** A film stops being scheduled this many days after release — approximates a typical
 * theatrical run length; without this, a low-popularity title from 8 months ago would
 * still compete for slots forever. */
const MAX_RUN_WINDOW_DAYS = 60;
/** At most this many distinct titles share one auditorium on one day — a single real
 * screen showing 15 different films in a day isn't realistic even with back-to-back
 * packing; this keeps the day's lineup readable in the demo too. */
const MAX_FILMS_PER_DAY = 6;
/** Every popularity weight gets this floor, so a film with TMDB popularity 0 still has a
 * nonzero (if small) chance at a slot instead of being mathematically excluded. */
const MIN_POPULARITY_WEIGHT = 1;

const OPEN_HOUR = 12; // theater doors, local time
const CLOSE_MINUTE_OF_DAY = 23 * 60 + 45; // last permissible showtime START, local time
const SLOT_GRID_MINUTES = 15; // showtimes start on the quarter-hour, like a real multiplex
const CLEANING_BUFFER_MIN = 20; // turnaround between showings in the same hall
const DEFAULT_RUNTIME_MIN = 110; // used only when TMDB didn't return a runtime

const MERIDIAN_TIMEZONE = "America/Los_Angeles";
const STANDARD_BASE_PRICE_CENTS = 1200; // the pricing engine's zone/format multipliers apply on top of this

function daysBetween(fromIso: string, toDate: Date): number {
  const from = new Date(`${fromIso}T00:00:00Z`);
  const toUtcMidnight = Date.UTC(
    toDate.getUTCFullYear(),
    toDate.getUTCMonth(),
    toDate.getUTCDate(),
  );
  return Math.round((toUtcMidnight - from.getTime()) / 86_400_000);
}

/**
 * "Smooth weighted round robin" — the same algorithm nginx uses to spread load across
 * weighted backends. Repeatedly picks the film whose running `current` counter is
 * highest, adds each film's weight to its counter every pick, then subtracts the total
 * weight from whichever film was picked. This distributes picks proportionally to
 * popularity AND interleaves them (the top film doesn't monopolize the first N slots) —
 * exactly the shape a real theater's daily lineup has.
 */
export function* weightedRoundRobin(
  weighted: { key: string; weight: number }[],
): Generator<string> {
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  if (totalWeight <= 0) return;
  const current = new Map(weighted.map((w) => [w.key, 0]));
  for (;;) {
    for (const w of weighted) current.set(w.key, (current.get(w.key) ?? 0) + w.weight);
    let bestKey = weighted[0]!.key;
    let bestValue = -Infinity;
    for (const w of weighted) {
      const value = current.get(w.key)!;
      if (value > bestValue) {
        bestValue = value;
        bestKey = w.key;
      }
    }
    current.set(bestKey, current.get(bestKey)! - totalWeight);
    yield bestKey;
  }
}

/**
 * Packs one auditorium's showtimes for one calendar day: eligible films (already released,
 * still within their run window) are chosen via weighted round robin and placed back-to-
 * back on a quarter-hour grid until the operating window is full. A single screen can't
 * show two films at once, so this is a genuine bin-packing pass, not just a lookup table.
 */
function scheduleOneDay(
  auditorium: AuditoriumLayout,
  films: Film[],
  releaseDateIso: (f: Film) => string,
  year: number,
  month: number,
  day: number,
): Showtime[] {
  const dayStart = new Date(Date.UTC(year, month - 1, day));
  const eligible = films
    .filter((f) => {
      const age = daysBetween(releaseDateIso(f), dayStart);
      return age >= 0 && age <= MAX_RUN_WINDOW_DAYS;
    })
    .slice(0, MAX_FILMS_PER_DAY);
  if (eligible.length === 0) return [];

  const byId = new Map(eligible.map((f) => [String(f.tmdbId), f]));
  const picker = weightedRoundRobin(
    eligible.map((f) => ({ key: String(f.tmdbId), weight: f.popularity + MIN_POPULARITY_WEIGHT })),
  );

  const showtimes: Showtime[] = [];
  let cursorMin = OPEN_HOUR * 60;

  for (const filmId of picker) {
    const film = byId.get(filmId)!;
    const runtime = film.runtimeMin ?? DEFAULT_RUNTIME_MIN;
    const slotMin = Math.ceil(cursorMin / SLOT_GRID_MINUTES) * SLOT_GRID_MINUTES;
    if (slotMin > CLOSE_MINUTE_OF_DAY) break; // no more room today

    const hour = Math.floor(slotMin / 60);
    const minute = slotMin % 60;
    const startsAt = zonedWallTimeToUtc(year, month, day, hour, minute, MERIDIAN_TIMEZONE);

    showtimes.push({
      id: `${auditorium.id}@${startsAt.toISOString()}`,
      auditoriumId: auditorium.id,
      tmdbFilmId: film.tmdbId,
      startsAtIso: startsAt.toISOString(),
      localTime: formatHHMM(hour, minute),
      baseCents: STANDARD_BASE_PRICE_CENTS,
    });

    cursorMin = slotMin + runtime + CLEANING_BUFFER_MIN;
  }

  return showtimes;
}

/**
 * Builds the full DAYS_AHEAD-day showtime grid across every auditorium, starting from
 * `startDate` — an explicit LOCAL calendar date (year/month/day), not a UTC `Date`. That
 * used to be a real bug: a raw UTC `Date`'s calendar day can be a full day ahead of or
 * behind what "today" means in Los Angeles depending on the hour the ingest job happens
 * to run, and a late-night LA showtime's `startsAtIso` legitimately falls on the NEXT
 * UTC calendar date regardless — conflating "UTC today" with "Meridian's today" produced
 * an off-by-one day at the schedule's tail. Callers should resolve "today" via
 * `currentLocalCalendarDate(new Date(), MERIDIAN_TIMEZONE)`, not pass a raw Date.
 */
export function buildSchedule(
  auditoriums: AuditoriumLayout[],
  films: Film[],
  startDate: LocalCalendarDate,
): Showtime[] {
  const showtimes: Showtime[] = [];
  for (const auditorium of auditoriums) {
    for (let offset = 0; offset < DAYS_AHEAD; offset += 1) {
      const d = addDays(startDate, offset);
      showtimes.push(
        ...scheduleOneDay(auditorium, films, (f) => f.releaseDate, d.year, d.month, d.day),
      );
    }
  }
  return showtimes;
}

export { MERIDIAN_TIMEZONE };
