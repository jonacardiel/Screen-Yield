import { describe, expect, it } from "vitest";
import { FilmSchema, ShowtimeSchema, SnapshotSchema } from "../src/catalog.js";

describe("FilmSchema", () => {
  it("accepts a well-formed film", () => {
    const result = FilmSchema.safeParse({
      tmdbId: 27205,
      title: "Inception",
      releaseDate: "2010-07-16",
      runtimeMin: 148,
      posterPath: "/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg",
      popularity: 42.1,
    });
    expect(result.success).toBe(true);
  });

  it("allows a null runtime and poster (TMDB sometimes omits both)", () => {
    const result = FilmSchema.safeParse({
      tmdbId: 1,
      title: "Untitled",
      releaseDate: "2026-01-01",
      runtimeMin: null,
      posterPath: null,
      popularity: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed release date", () => {
    const result = FilmSchema.safeParse({
      tmdbId: 1,
      title: "X",
      releaseDate: "01/01/2026",
      runtimeMin: 90,
      posterPath: null,
      popularity: 1,
    });
    expect(result.success).toBe(false);
  });
});

describe("ShowtimeSchema", () => {
  it("accepts a well-formed showtime", () => {
    const result = ShowtimeSchema.safeParse({
      id: "meridian-downtown/hall-01@2026-09-25T19:00:00-07:00",
      auditoriumId: "meridian-downtown/hall-01",
      tmdbFilmId: 27205,
      startsAtIso: "2026-09-25T19:00:00-07:00",
      localTime: "19:00",
      baseCents: 1200,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a startsAtIso without a timezone offset", () => {
    const result = ShowtimeSchema.safeParse({
      id: "x@y",
      auditoriumId: "meridian-downtown/hall-01",
      tmdbFilmId: 1,
      startsAtIso: "2026-09-25T19:00:00", // no offset — ambiguous, forbidden by the schema
      localTime: "19:00",
      baseCents: 1200,
    });
    expect(result.success).toBe(false);
  });
});

describe("SnapshotSchema", () => {
  it("requires the exact TMDB attribution string", () => {
    const badSnapshot = {
      meta: {
        generatedAt: "2026-09-21T08:00:00Z",
        tmdbAttribution: "Powered by TMDB!", // wrong wording
        filmCount: 0,
        showtimeCount: 0,
      },
      films: [],
      showtimes: [],
    };
    expect(SnapshotSchema.safeParse(badSnapshot).success).toBe(false);
  });

  it("rejects a showtime whose tmdbFilmId isn't in the films array", () => {
    const orphanShowtime = {
      meta: {
        generatedAt: "2026-09-21T08:00:00Z",
        tmdbAttribution:
          "This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.",
        filmCount: 1,
        showtimeCount: 1,
      },
      films: [
        {
          tmdbId: 1,
          title: "A",
          releaseDate: "2026-09-01",
          runtimeMin: 100,
          posterPath: null,
          popularity: 10,
        },
      ],
      showtimes: [
        {
          id: "hall@x",
          auditoriumId: "meridian-downtown/hall-01",
          tmdbFilmId: 999, // not in films
          startsAtIso: "2026-09-25T19:00:00-07:00",
          localTime: "19:00",
          baseCents: 1200,
        },
      ],
    };
    expect(SnapshotSchema.safeParse(orphanShowtime).success).toBe(false);
  });
});
