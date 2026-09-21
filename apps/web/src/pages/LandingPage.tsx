import { useMemo } from "react";
import type { Showtime } from "@screen-yield/schema";
import { FilmCard } from "../components/FilmCard";
import { filmsById, hall01, useUpcomingShowtimes } from "../lib/snapshot";

export function LandingPage() {
  const { upcomingShowtimes } = useUpcomingShowtimes(hall01.id);

  // Group by film, keeping only the first (soonest) showtime per film — the source list
  // is already sorted soonest-first, so the first entry seen per film is its soonest.
  const soonestByFilm = useMemo(() => {
    const map = new Map<number, Showtime>();
    for (const s of upcomingShowtimes) {
      if (!map.has(s.tmdbFilmId)) map.set(s.tmdbFilmId, s);
    }
    return map;
  }, [upcomingShowtimes]);

  if (upcomingShowtimes.length === 0) {
    return <EmptySnapshotState />;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-surge-text-muted">Now showing at {hall01.name}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...soonestByFilm.entries()].map(([filmId, soonestShowtime]) => {
          const film = filmsById.get(filmId);
          if (!film) return null;
          return <FilmCard key={filmId} film={film} soonestShowtime={soonestShowtime} />;
        })}
      </div>
    </div>
  );
}

export function EmptySnapshotState() {
  return (
    <div className="max-w-md mx-auto text-center space-y-3 py-16">
      <h1 className="text-lg font-semibold text-surge-text">
        No upcoming showtimes in the snapshot
      </h1>
      <p className="text-sm text-surge-text-muted">
        <code className="text-surge-text-faint">packages/snapshot</code> has no showtimes past the
        current moment — either the ETL hasn't run yet, or every scheduled showing has already
        started. Run{" "}
        <code className="text-surge-text-faint">npm run ingest --workspace=@screen-yield/etl</code>{" "}
        (needs a <code className="text-surge-text-faint">TMDB_API_KEY</code>, see{" "}
        <code className="text-surge-text-faint">apps/etl/.env.example</code>) to populate this
        week's real films and showtimes.
      </p>
    </div>
  );
}
