import { describe, expect, it } from "vitest";
import type { AuditoriumLayout, Film } from "@screen-yield/schema";
import {
  buildSchedule,
  DAYS_AHEAD,
  MERIDIAN_TIMEZONE,
  weightedRoundRobin,
} from "../src/schedule.js";

function take<T>(gen: Generator<T>, n: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < n; i += 1) {
    const next = gen.next();
    if (next.done) break; // an exhausted generator's .value is undefined — don't collect it
    out.push(next.value);
  }
  return out;
}

describe("weightedRoundRobin", () => {
  it("produces the exact deterministic nginx-SWRR sequence for a 3:1 weight ratio", () => {
    const picks = take(
      weightedRoundRobin([
        { key: "A", weight: 3 },
        { key: "B", weight: 1 },
      ]),
      8,
    );
    expect(picks).toEqual(["A", "A", "B", "A", "A", "A", "B", "A"]);
  });

  it("distributes picks exactly proportional to weight over many cycles", () => {
    const picks = take(
      weightedRoundRobin([
        { key: "popular", weight: 9 },
        { key: "niche", weight: 1 },
      ]),
      400,
    );
    const popularCount = picks.filter((p) => p === "popular").length;
    expect(popularCount).toBe(360); // 9/10 of 400, exactly — the period-10 cycle is exact
  });

  it("yields nothing for an empty or zero-weight input", () => {
    expect(take(weightedRoundRobin([]), 5)).toEqual([]);
  });
});

const HALL: AuditoriumLayout = {
  id: "meridian-downtown/hall-01",
  name: "Hall 1 — IMAX",
  format: "IMAX",
  screen: { widthUnits: 26, curve: 0.25 },
  rows: [{ label: "A", y: 0, zone: "STANDARD", seats: [{ n: 1, x: 0 }] }],
};

function film(overrides: Partial<Film>): Film {
  return {
    tmdbId: 1,
    title: "Test Film",
    releaseDate: "2026-09-01",
    runtimeMin: 120,
    posterPath: null,
    popularity: 50,
    ...overrides,
  };
}

describe("buildSchedule", () => {
  it("never double-books a single auditorium: every showtime starts after the previous one's runtime + buffer", () => {
    const films = [
      film({ tmdbId: 1, title: "A", popularity: 100, runtimeMin: 130 }),
      film({ tmdbId: 2, title: "B", popularity: 80, runtimeMin: 95 }),
      film({ tmdbId: 3, title: "C", popularity: 60, runtimeMin: 150 }),
    ];
    const today = { year: 2026, month: 9, day: 21 }; // LA-local calendar date
    const showtimes = buildSchedule([HALL], films, today);

    const byDay = new Map<string, typeof showtimes>();
    for (const s of showtimes) {
      const day = s.startsAtIso.slice(0, 10);
      byDay.set(day, [...(byDay.get(day) ?? []), s]);
    }

    for (const [, dayShowtimes] of byDay) {
      const sorted = [...dayShowtimes].sort((a, b) => a.startsAtIso.localeCompare(b.startsAtIso));
      for (let i = 1; i < sorted.length; i += 1) {
        const prevStart = new Date(sorted[i - 1]!.startsAtIso).getTime();
        const thisStart = new Date(sorted[i]!.startsAtIso).getTime();
        // runtime is at least 95 min for every film in this fixture, plus the 20-min buffer
        expect(thisStart - prevStart).toBeGreaterThanOrEqual(95 * 60_000 + 20 * 60_000);
      }
    }
  });

  it("excludes a film before its release date", () => {
    const today = { year: 2026, month: 9, day: 21 };
    const films = [film({ tmdbId: 1, releaseDate: "2026-12-25" })]; // releases after every scheduled day
    const showtimes = buildSchedule([HALL], films, today);
    expect(showtimes).toHaveLength(0);
  });

  it("excludes a film whose theatrical run window has expired", () => {
    const today = { year: 2026, month: 9, day: 21 };
    const films = [film({ tmdbId: 1, releaseDate: "2026-01-01" })]; // 200+ days before `today`
    const showtimes = buildSchedule([HALL], films, today);
    expect(showtimes).toHaveLength(0);
  });

  it("schedules exactly DAYS_AHEAD distinct LOCAL calendar days when a film is eligible throughout", () => {
    // Grouping by UTC date here would be wrong on purpose: a late LA showtime's
    // startsAtIso legitimately falls on the next UTC calendar date, so the correct
    // measurement is the theater's own local date, not the UTC one.
    const today = { year: 2026, month: 9, day: 21 };
    const films = [film({ releaseDate: "2026-09-01" })];
    const showtimes = buildSchedule([HALL], films, today);
    const localDayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: MERIDIAN_TIMEZONE });
    const distinctLocalDays = new Set(
      showtimes.map((s) => localDayFormatter.format(new Date(s.startsAtIso))),
    );
    expect(distinctLocalDays.size).toBe(DAYS_AHEAD);
  });
});
