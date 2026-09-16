import type { PriceBreakdown as PriceBreakdownT } from "@screen-yield/pricing";
import type { FlatSeat } from "@screen-yield/schema";

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function mult(x: number): string {
  return `×${x.toFixed(3)}`;
}

interface Row {
  label: string;
  value: string;
  muted?: boolean;
}

/**
 * The "receipts" panel — the whole point of the demo. Every multiplier the engine applied
 * to THIS seat, in order, ending in the price actually charged. Nothing here is summarized
 * or hidden; if the ceiling capped the price, that's shown explicitly rather than folded
 * silently into the total.
 */
export function PriceBreakdown({
  seat,
  breakdown,
}: {
  seat: FlatSeat | null;
  breakdown: PriceBreakdownT | null;
}) {
  if (!seat || !breakdown) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-zinc-400 text-sm">
        Select a seat to see exactly how its price was calculated.
      </div>
    );
  }

  const { factors } = breakdown;
  const rows: Row[] = [
    { label: "Zone base", value: usd(factors.zoneBaseCents) },
    ...(factors.surchargeCents > 0
      ? [{ label: "Format surcharge", value: `+${usd(factors.surchargeCents)}` }]
      : []),
    { label: "Occupancy", value: mult(factors.occupancyMult) },
    { label: "Time to showtime", value: mult(factors.timeMult) },
    { label: "Opening-week window", value: mult(factors.releaseMult) },
    { label: "Day / time slot", value: mult(factors.dowSlotMult) },
    { label: "Demand velocity", value: mult(factors.velocityMult) },
    ...(factors.salvageMult !== 1
      ? [{ label: "Last-minute salvage", value: mult(factors.salvageMult) }]
      : []),
  ];

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-zinc-300">
          Seat {seat.rowLabel}
          {seat.seatNumber}
        </h3>
        <span className="text-xs uppercase tracking-wide text-zinc-500">{seat.zone}</span>
      </div>

      <dl className="space-y-1 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between text-zinc-400">
            <dt>{r.label}</dt>
            <dd className="tabular-nums text-zinc-200">{r.value}</dd>
          </div>
        ))}
      </dl>

      <div className="border-t border-zinc-800 pt-2 flex justify-between text-sm text-zinc-400">
        <span>Raw computed price</span>
        <span className="tabular-nums">{usd(Math.round(breakdown.rawCents))}</span>
      </div>

      {breakdown.wasClamped && (
        <div className="rounded-md bg-fuchsia-950/50 border border-fuchsia-900 px-2 py-1 text-xs text-fuchsia-300">
          Capped at the ceiling ({usd(breakdown.ceilingCents)}) — the engine wanted to charge more.
        </div>
      )}

      <div className="border-t border-zinc-800 pt-2 flex justify-between items-baseline">
        <span className="text-zinc-300">You pay</span>
        <span className="text-2xl font-semibold tabular-nums text-zinc-50">
          {usd(breakdown.finalCents)}
        </span>
      </div>
    </div>
  );
}
