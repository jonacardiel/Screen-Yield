import { useMemo } from "react";
import {
  AuditoriumLayoutSchema,
  FilmSchema,
  flattenSeats,
  ShowtimeSchema,
  type Showtime,
} from "@screen-yield/schema";
import hall01Raw from "@screen-yield/layouts/hall-01";
import filmsRaw from "@screen-yield/snapshot/films";
import showtimesRaw from "@screen-yield/snapshot/showtimes";
import metaRaw from "@screen-yield/snapshot/meta";
import { z } from "zod";

export const TMDB_ATTRIBUTION =
  "This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.";
export const MERIDIAN_TIMEZONE = "America/Los_Angeles"; // must match apps/etl's MERIDIAN_TIMEZONE

// Validated at module load — a bad snapshot commit (a hand-edit gone wrong, a partial
// ingest write) fails loudly here instead of rendering something quietly wrong.
export const hall01 = AuditoriumLayoutSchema.parse(hall01Raw);
export const HALL_SEATS = flattenSeats(hall01);
export const films = z.array(FilmSchema).parse(filmsRaw);
export const allShowtimes = z.array(ShowtimeSchema).parse(showtimesRaw);
export const meta = metaRaw as { generatedAt: string; filmCount: number; showtimeCount: number };

export const filmsById = new Map(films.map((f) => [f.tmdbId, f]));

export function posterUrl(posterPath: string | null): string | null {
  // Hotlinked from TMDB's own image CDN, never downloaded/re-hosted — see the README's
  // "Data & attribution" section for why that distinction matters under TMDB's terms.
  return posterPath ? `https://image.tmdb.org/t/p/w200${posterPath}` : null;
}

/**
 * Only this auditorium's showtimes, only ones that haven't started yet, soonest first — a
 * real booking UI wouldn't offer a ticket for a showing already in progress.
 */
export function useUpcomingShowtimes(auditoriumId: string): {
  now: number;
  upcomingShowtimes: Showtime[];
} {
  const now = Date.now();
  const upcomingShowtimes = useMemo(
    () =>
      allShowtimes
        .filter((s) => s.auditoriumId === auditoriumId && new Date(s.startsAtIso).getTime() > now)
        .sort((a, b) => a.startsAtIso.localeCompare(b.startsAtIso)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `now` intentionally does not retrigger this on every render
    [auditoriumId],
  );
  return { now, upcomingShowtimes };
}
