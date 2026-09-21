import { useMemo, useState } from "react";
import { Link } from "wouter";
import type { FlatSeat, Showtime } from "@screen-yield/schema";
import { price, type PriceContext } from "@screen-yield/pricing";
import { Percent, TrendingUp } from "lucide-react";
import { SeatMap } from "../components/SeatMap";
import { PriceBreakdown } from "../components/PriceBreakdown";
import { seatSaleRank } from "../lib/demoOccupancy";
import { daysSinceRelease, localDayOfWeek, relativeTimeLabel } from "../lib/localTime";
import { useSeatHold } from "../hooks/useSeatHold";
import {
  HALL_SEATS,
  MERIDIAN_TIMEZONE,
  filmsById,
  hall01,
  posterUrl,
  useUpcomingShowtimes,
} from "../lib/snapshot";

export function BookingPage({ filmId }: { filmId: number }) {
  const { now, upcomingShowtimes: allUpcoming } = useUpcomingShowtimes(hall01.id);
  const film = filmsById.get(filmId) ?? null;

  const upcomingShowtimes = useMemo(
    () => allUpcoming.filter((s) => s.tmdbFilmId === filmId),
    [allUpcoming, filmId],
  );

  const [selectedShowtimeId, setSelectedShowtimeId] = useState<string | null>(
    upcomingShowtimes[0]?.id ?? null,
  );
  const [occupancyPct, setOccupancyPct] = useState(50);
  const [demandVelocityPct, setDemandVelocityPct] = useState(140);
  const seatHold = useSeatHold();

  const showtime = upcomingShowtimes.find((s) => s.id === selectedShowtimeId) ?? null;

  const occupancy = occupancyPct / 100;
  const demandVelocityRatio = demandVelocityPct / 100;
  const isSold = (seatId: string) => seatSaleRank(seatId, selectedShowtimeId ?? "none") < occupancy;

  function handleSelectSeat(seatId: string) {
    if (seatHold.status === "held" && seatHold.heldSeatId === seatId) {
      seatHold.cancel();
    } else {
      seatHold.hold(seatId);
    }
  }

  function contextFor(seat: FlatSeat): PriceContext | null {
    if (!showtime || !film) return null;
    const hoursToShow = (new Date(showtime.startsAtIso).getTime() - now) / 3_600_000;
    return {
      basePriceCents: showtime.baseCents,
      zone: seat.zone,
      isFrontRow: seat.isFrontRow,
      format: hall01.format,
      occupancy,
      hoursToShow,
      daysSinceRelease: daysSinceRelease(showtime.startsAtIso, film.releaseDate, MERIDIAN_TIMEZONE),
      dayOfWeek: localDayOfWeek(showtime.startsAtIso, MERIDIAN_TIMEZONE),
      localHour: Number(showtime.localTime.slice(0, 2)),
      demandVelocityRatio,
    };
  }

  const priceForSeat = (seat: FlatSeat) => {
    const ctx = contextFor(seat);
    return ctx ? price(ctx).finalCents : 0;
  };

  const selectedSeat = useMemo(
    () => HALL_SEATS.find((s) => s.seatId === seatHold.heldSeatId) ?? null,
    [seatHold.heldSeatId],
  );
  const selectedBreakdown = useMemo(() => {
    if (!selectedSeat) return null;
    const ctx = contextFor(selectedSeat);
    return ctx ? price(ctx) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- contextFor closes over these; they ARE the deps
  }, [selectedSeat, showtime, occupancy, demandVelocityRatio]);

  const soldCount = showtime ? HALL_SEATS.filter((s) => isSold(s.seatId)).length : 0;

  if (!film || upcomingShowtimes.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center space-y-3 py-16">
        <h1 className="text-lg font-semibold text-surge-text">This film isn't currently showing</h1>
        <p className="text-sm text-surge-text-muted">
          It may have finished its run at {hall01.name}, or the link is out of date.
        </p>
        <Link href="/" className="inline-block text-sm text-surge-cyan hover:underline">
          ← All movies
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <span className="sr-only" role="status" aria-live="polite">
        {seatHold.announcement}
      </span>

      <Link
        href="/"
        className="inline-block text-sm text-surge-text-muted hover:text-surge-cyan transition-colors duration-150"
      >
        ← All movies
      </Link>

      <div className="rounded-lg border border-surge-border/70 bg-surge-surface-2/60 p-4 flex gap-4 items-start">
        {posterUrl(film.posterPath) && (
          <img
            src={posterUrl(film.posterPath)!}
            alt=""
            className="w-16 rounded-md shadow-lg shrink-0"
            loading="lazy"
          />
        )}
        <div>
          <h2 className="font-medium text-surge-text">{film.title}</h2>
          <p className="text-sm text-surge-text-muted">
            Released {film.releaseDate} ·{" "}
            {film.runtimeMin ? `${film.runtimeMin} min` : "runtime unknown"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-4">
          <ShowtimePicker
            showtimes={upcomingShowtimes}
            selectedId={selectedShowtimeId}
            onSelect={(id) => {
              setSelectedShowtimeId(id);
              seatHold.reset();
            }}
            now={now}
          />

          <div className="rounded-lg border border-surge-border/70 bg-surge-surface-2/60 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Slider
              label="Occupancy"
              value={occupancyPct}
              min={0}
              max={98}
              onChange={setOccupancyPct}
              display={`${occupancyPct}% (${soldCount}/${HALL_SEATS.length} sold)`}
            />
            <Slider
              label="Demand velocity"
              value={demandVelocityPct}
              min={50}
              max={300}
              onChange={setDemandVelocityPct}
              display={`${(demandVelocityPct / 100).toFixed(2)}x baseline`}
            />
          </div>

          <div className="rounded-xl border border-surge-border bg-gradient-to-b from-surge-surface to-[#080b15] p-4 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)]">
            <SeatMap
              seats={HALL_SEATS}
              screen={hall01.screen}
              priceForSeat={priceForSeat}
              isSold={isSold}
              heldSeatId={seatHold.heldSeatId}
              isHeldSeatBooked={seatHold.status === "booked"}
              onSelectSeat={handleSelectSeat}
            />
          </div>

          <Legend />
        </div>

        <aside className="space-y-4">
          <PriceBreakdown
            seat={selectedSeat}
            breakdown={selectedBreakdown}
            holdStatus={seatHold.status}
            msRemaining={seatHold.msRemaining}
            onConfirm={seatHold.confirm}
            onCancel={seatHold.cancel}
            justExpired={seatHold.justExpired}
          />
        </aside>
      </div>
    </div>
  );
}

function ShowtimePicker({
  showtimes,
  selectedId,
  onSelect,
  now,
}: {
  showtimes: Showtime[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  now: number;
}) {
  return (
    <div className="rounded-lg border border-surge-border/70 bg-surge-surface-2/60 p-3">
      <label className="text-sm text-surge-text-muted mb-2 block" htmlFor="showtime-select">
        Showtime
      </label>
      <select
        id="showtime-select"
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full bg-surge-bg border border-surge-border/70 rounded-md px-3 py-2 text-sm text-surge-text focus:border-surge-cyan focus:outline-none transition-colors duration-150"
      >
        {showtimes.slice(0, 60).map((s) => {
          const date = new Date(s.startsAtIso);
          const dateLabel = new Intl.DateTimeFormat("en-US", {
            timeZone: MERIDIAN_TIMEZONE,
            weekday: "short",
            month: "short",
            day: "numeric",
          }).format(date);
          return (
            <option key={s.id} value={s.id}>
              {dateLabel}, {s.localTime} ({relativeTimeLabel(s.startsAtIso, now)})
            </option>
          );
        })}
      </select>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  display: string;
}) {
  const Icon = label === "Occupancy" ? Percent : TrendingUp;
  const inputId = `slider-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="block text-sm">
      <label
        htmlFor={inputId}
        className="flex justify-between text-surge-text-muted mb-1 items-center gap-1"
      >
        <span className="flex items-center gap-1">
          <Icon className="w-3.5 h-3.5 text-surge-text-muted" />
          {label}
        </span>
        <span className="font-mono tabular-nums text-surge-text">{display}</span>
      </label>
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-surge-cyan"
      />
    </div>
  );
}

function Legend() {
  const items: { label: string; color: string }[] = [
    { label: "Standard", color: "var(--zone-standard)" },
    { label: "Premium", color: "var(--zone-premium)" },
    { label: "Recliner", color: "var(--zone-recliner)" },
  ];
  return (
    <div className="flex flex-wrap gap-4 text-xs text-surge-text-muted px-1">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: i.color }}
            aria-hidden="true"
          />
          {i.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block w-3 h-3 rounded-sm bg-[var(--seat-sold)] opacity-50"
          aria-hidden="true"
        />
        Sold
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block w-3 h-3 rounded-sm bg-[var(--seat-held)]"
          aria-hidden="true"
        />
        Held
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block w-3 h-3 rounded-sm bg-[var(--seat-selected)]"
          aria-hidden="true"
        />
        Booked
      </span>
    </div>
  );
}
