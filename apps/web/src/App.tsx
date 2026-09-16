import { useMemo, useState } from "react";
import { AuditoriumLayoutSchema, flattenSeats, type FlatSeat } from "@screen-yield/schema";
import { price, type PriceContext } from "@screen-yield/pricing";
import hall01Raw from "@screen-yield/layouts/hall-01";
import { SeatMap } from "./components/SeatMap";
import { PriceBreakdown } from "./components/PriceBreakdown";
import { seatSaleRank } from "./lib/demoOccupancy";

// Validated at module load, not trusted blindly — if the authored JSON ever drifts from
// the schema (a bad edit to generate-hall.mjs, a hand edit gone wrong), this throws loudly
// at build/dev time instead of rendering a broken seat map silently.
const hall01 = AuditoriumLayoutSchema.parse(hall01Raw);
const HALL_SEATS = flattenSeats(hall01);

// M1's single hardcoded showtime: the same Friday-7pm, day-4-of-release scenario the
// pricing engine's worked example (README §6 / packages/pricing/test/engine.test.ts) is
// built around — so the demo and the documented math are provably the same computation.
const SHOWTIME_DAY_OF_WEEK = 5; // Friday
const SHOWTIME_LOCAL_HOUR = 19; // 7:00 PM
const SHOWTIME_DAYS_SINCE_RELEASE = 4;
const BASE_PRICE_CENTS = 1200; // $12.00 standard-seat base

export default function App() {
  const [occupancyPct, setOccupancyPct] = useState(50);
  const [hoursToShow, setHoursToShow] = useState(6);
  const [demandVelocityPct, setDemandVelocityPct] = useState(140);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);

  const occupancy = occupancyPct / 100;
  const demandVelocityRatio = demandVelocityPct / 100;

  const isSold = (seatId: string) => seatSaleRank(seatId) < occupancy;

  function contextFor(seat: FlatSeat): PriceContext {
    return {
      basePriceCents: BASE_PRICE_CENTS,
      zone: seat.zone,
      isFrontRow: seat.isFrontRow,
      format: hall01.format,
      occupancy,
      hoursToShow,
      daysSinceRelease: SHOWTIME_DAYS_SINCE_RELEASE,
      dayOfWeek: SHOWTIME_DAY_OF_WEEK,
      localHour: SHOWTIME_LOCAL_HOUR,
      demandVelocityRatio,
    };
  }

  const priceForSeat = (seat: FlatSeat) => price(contextFor(seat)).finalCents;

  const selectedSeat = useMemo(
    () => HALL_SEATS.find((s) => s.seatId === selectedSeatId) ?? null,
    [selectedSeatId],
  );
  const selectedBreakdown = useMemo(
    () => (selectedSeat ? price(contextFor(selectedSeat)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- contextFor closes over the sliders, which ARE the deps below
    [selectedSeat, occupancy, hoursToShow, demandVelocityRatio],
  );

  const soldCount = HALL_SEATS.filter((s) => isSold(s.seatId)).length;

  return (
    <div className="min-h-screen bg-[#0b0d12] text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">
          screen-yield <span className="text-zinc-500 font-normal">· Meridian Cinemas</span>
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {hall01.name} — Friday 7:00 PM, day 4 of release. Every price below is computed live by{" "}
          <code className="text-zinc-400">@screen-yield/pricing</code>, the same function that will
          run on the server once seat holds go live.
        </p>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Slider
              label="Occupancy"
              value={occupancyPct}
              min={0}
              max={98}
              onChange={setOccupancyPct}
              display={`${occupancyPct}% (${soldCount}/${HALL_SEATS.length} sold)`}
            />
            <Slider
              label="Hours to showtime"
              value={hoursToShow}
              min={0}
              max={168}
              onChange={setHoursToShow}
              display={`${hoursToShow}h`}
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

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
            <SeatMap
              seats={HALL_SEATS}
              screen={hall01.screen}
              priceForSeat={priceForSeat}
              isSold={isSold}
              selectedSeatId={selectedSeatId}
              onSelectSeat={setSelectedSeatId}
            />
          </div>

          <Legend />
        </div>

        <aside className="space-y-4">
          <PriceBreakdown seat={selectedSeat} breakdown={selectedBreakdown} />
        </aside>
      </main>
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
  return (
    <label className="block text-sm">
      <div className="flex justify-between text-zinc-400 mb-1">
        <span>{label}</span>
        <span className="tabular-nums text-zinc-300">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-fuchsia-500"
      />
    </label>
  );
}

function Legend() {
  const items: { label: string; color: string }[] = [
    { label: "Standard", color: "var(--zone-standard)" },
    { label: "Premium", color: "var(--zone-premium)" },
    { label: "Recliner", color: "var(--zone-recliner)" },
  ];
  return (
    <div className="flex flex-wrap gap-4 text-xs text-zinc-400 px-1">
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
        <span className="inline-block w-3 h-3 rounded-sm bg-[var(--seat-sold)] opacity-50" aria-hidden="true" />
        Sold
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-[var(--seat-selected)]" aria-hidden="true" />
        Selected
      </span>
    </div>
  );
}
