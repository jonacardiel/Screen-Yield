import { useEffect } from "react";
import { animate, AnimatePresence, motion, useMotionValue, useTransform } from "motion/react";
import type { PriceBreakdown as PriceBreakdownT } from "@screen-yield/pricing";
import type { FlatSeat } from "@screen-yield/schema";
import { formatRemaining } from "../lib/seatHold";
import type { HoldStatus } from "../hooks/useSeatHold";

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

function AnimatedPrice({ cents }: { cents: number }) {
  const mv = useMotionValue(cents);
  const display = useTransform(mv, (v) => usd(Math.round(v)));
  useEffect(() => {
    const controls = animate(mv, cents, { duration: 0.4, ease: "easeOut" });
    return () => controls.stop();
  }, [cents, mv]);
  return <motion.span className="font-mono tabular-nums text-surge-text">{display}</motion.span>;
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
  holdStatus,
  msRemaining,
  onConfirm,
  onCancel,
  justExpired,
}: {
  seat: FlatSeat | null;
  breakdown: PriceBreakdownT | null;
  holdStatus: HoldStatus;
  msRemaining: number;
  onConfirm: () => void;
  onCancel: () => void;
  justExpired: boolean;
}) {
  if (!seat || !breakdown) {
    return (
      <div className="rounded-xl border border-surge-border bg-gradient-to-b from-surge-surface to-[#080b15] p-4 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] text-surge-text-muted text-sm space-y-2">
        {justExpired && (
          <p className="text-surge-amber font-mono text-xs">Hold expired — seat released.</p>
        )}
        <p>Select a seat to see exactly how its price was calculated.</p>
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
    <div className="rounded-xl border border-surge-border bg-gradient-to-b from-surge-surface to-[#080b15] p-4 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-surge-text">
          Seat {seat.rowLabel}
          {seat.seatNumber}
        </h3>
        <span className="text-xs uppercase tracking-wide text-surge-text-muted">{seat.zone}</span>
      </div>

      <dl className="space-y-1 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between text-surge-text-muted">
            <dt>{r.label}</dt>
            <dd className="font-mono tabular-nums text-surge-text">{r.value}</dd>
          </div>
        ))}
      </dl>

      <div className="border-t border-surge-border pt-2 flex justify-between text-sm text-surge-text-muted">
        <span>Raw computed price</span>
        <span className="font-mono tabular-nums text-surge-text">
          {usd(Math.round(breakdown.rawCents))}
        </span>
      </div>

      <AnimatePresence>
        {breakdown.wasClamped && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{
              opacity: 1,
              scale: [0.96, 1.02, 1],
              boxShadow: [
                "0 0 0px rgba(239,68,68,0)",
                "0 0 16px rgba(239,68,68,0.35)",
                "0 0 0px rgba(239,68,68,0)",
              ],
            }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="rounded-md bg-surge-red-dim/30 border border-surge-red/50 px-2 py-1 text-xs text-red-300"
          >
            Capped at the ceiling ({usd(breakdown.ceilingCents)}) — the engine wanted to charge
            more.
          </motion.div>
        )}
      </AnimatePresence>

      <div className="border-t border-surge-border pt-2 space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-surge-text">You pay</span>
          <span className="text-2xl font-semibold">
            <AnimatedPrice cents={breakdown.finalCents} />
          </span>
        </div>

        {holdStatus === "held" && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs text-surge-amber">
              <span>Held — expires in</span>
              <span className="font-mono tabular-nums">{formatRemaining(msRemaining)}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onConfirm}
                className="flex-1 rounded-md bg-surge-cyan/90 hover:bg-surge-cyan text-surge-bg text-sm font-medium py-1.5 transition-colors duration-150"
              >
                Confirm booking
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="text-xs text-surge-text-muted hover:text-surge-text underline underline-offset-2"
              >
                Cancel hold
              </button>
            </div>
            <p className="text-[11px] text-surge-text-faint font-mono">
              Simulated checkout — no real inventory lock, no payment.
            </p>
          </div>
        )}

        {holdStatus === "booked" && (
          <div className="rounded-md border border-surge-border bg-surge-surface-2 px-2 py-1.5 text-xs text-surge-text flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: "var(--seat-selected)" }}
              aria-hidden="true"
            />
            Booked — this seat is confirmed for this session.
          </div>
        )}
      </div>
    </div>
  );
}
