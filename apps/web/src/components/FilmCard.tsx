import { Link } from "wouter";
import { Clapperboard } from "lucide-react";
import type { Film, Showtime } from "@screen-yield/schema";
import { posterUrl, MERIDIAN_TIMEZONE } from "../lib/snapshot";

export function FilmCard({ film, soonestShowtime }: { film: Film; soonestShowtime: Showtime }) {
  const poster = posterUrl(film.posterPath);
  const timeLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: MERIDIAN_TIMEZONE,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(soonestShowtime.startsAtIso));

  return (
    <Link
      href={`/film/${film.tmdbId}`}
      className="group rounded-xl border border-surge-border bg-gradient-to-b from-surge-surface to-[#080b15] p-3 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] flex flex-col gap-3 transition-colors duration-150 hover:border-surge-cyan/60"
    >
      <div className="aspect-[2/3] w-full rounded-lg overflow-hidden bg-surge-surface-2 flex items-center justify-center">
        {poster ? (
          <img src={poster} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <Clapperboard className="w-10 h-10 text-surge-text-faint" aria-hidden="true" />
        )}
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-surge-text leading-snug group-hover:text-surge-cyan transition-colors duration-150">
          {film.title}
        </h3>
        <p className="text-xs text-surge-text-muted">
          {film.releaseDate} · {film.runtimeMin ? `${film.runtimeMin} min` : "runtime unknown"}
        </p>
        <p className="text-xs font-mono tabular-nums text-surge-cyan">Next: {timeLabel}</p>
      </div>
    </Link>
  );
}
