import {
  DOW_SLOT_MULT,
  FORMAT_SURCHARGE_CENTS,
  FRONT_ROW_MULT,
  OCCUPANCY_ALPHA,
  OCCUPANCY_GAMMA,
  PRICE_CEILING_MULT,
  PRICE_FLOOR_MULT,
  RELEASE_DELTA,
  RELEASE_LAMBDA_DAYS,
  ROUND_TO_CENTS,
  SALVAGE_HOURS_THRESHOLD,
  SALVAGE_MULT,
  SALVAGE_OCCUPANCY_THRESHOLD,
  SLOT_BOUNDARIES,
  TIME_BETA,
  TIME_TAU_HOURS,
  VELOCITY_EPSILON,
  VELOCITY_RATIO_CLAMP_MAX,
  ZONE_MULT,
} from "./params.js";
import type { PriceBreakdown, PriceContext, Slot } from "./types.js";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Local hour (0-23) -> time-of-day slot, via the boundaries table in params.ts. */
export function classifySlot(localHour: number): Slot {
  const hit = SLOT_BOUNDARIES.find((b) => localHour < b.end);
  // SLOT_BOUNDARIES' last entry ends at 24, which covers every valid hour (0-23);
  // this fallback only matters for out-of-range input and keeps the function total.
  return hit ? hit.slot : "LATE";
}

/**
 * Round to the nearest 25 cents, then nudge an exact dollar down one cent ($50.00 ->
 * $49.99) UNLESS that nudge would go below `minCents` — the floor takes priority over
 * the psychological flourish. Exported standalone (and tested standalone) because it is
 * also used by the UI to preview a price before it's clamped.
 */
export function psychRound(cents: number, minCents = -Infinity): number {
  const nearestQuarter = Math.round(cents / ROUND_TO_CENTS) * ROUND_TO_CENTS;
  const nudged = nearestQuarter - 1;
  return nearestQuarter % 100 === 0 && nudged >= minCents ? nudged : nearestQuarter;
}

/**
 * Compute the price for one seat at one instant. PURE — no clock, no I/O, no randomness.
 * Identical PriceContext always yields an identical PriceBreakdown (see the determinism
 * invariant in pricing/test/engine.test.ts). This is what lets the exact same function
 * run in the browser for the live demo and on the server as the price actually charged.
 */
export function price(ctx: PriceContext): PriceBreakdown {
  const zoneMult =
    ctx.zone === "STANDARD" && ctx.isFrontRow
      ? ZONE_MULT.STANDARD * FRONT_ROW_MULT
      : ZONE_MULT[ctx.zone];
  const zoneBaseCents = Math.round(ctx.basePriceCents * zoneMult);
  const surchargeCents = FORMAT_SURCHARGE_CENTS[ctx.format];
  const base = zoneBaseCents + surchargeCents;

  const occupancy = clamp(ctx.occupancy, 0, 1);
  const occupancyMult = 1 + OCCUPANCY_ALPHA * occupancy ** OCCUPANCY_GAMMA;

  const hoursToShow = Math.max(0, ctx.hoursToShow);
  const timeMult = 1 + TIME_BETA * Math.exp(-hoursToShow / TIME_TAU_HOURS);

  const daysSinceRelease = Math.max(0, ctx.daysSinceRelease);
  const releaseMult = 1 + RELEASE_DELTA * Math.exp(-daysSinceRelease / RELEASE_LAMBDA_DAYS);

  const dayOfWeek = ((Math.trunc(ctx.dayOfWeek) % 7) + 7) % 7; // tolerate stray negative/out-of-range input
  const slot = classifySlot(ctx.localHour);
  // dayOfWeek is folded into 0..6 above, so this index is always in range
  const dowSlotMult = DOW_SLOT_MULT[dayOfWeek]![slot];

  const velocityExcess = clamp(ctx.demandVelocityRatio - 1, 0, VELOCITY_RATIO_CLAMP_MAX);
  const velocityMult = 1 + VELOCITY_EPSILON * velocityExcess;

  const salvageMult =
    hoursToShow < SALVAGE_HOURS_THRESHOLD && occupancy < SALVAGE_OCCUPANCY_THRESHOLD
      ? SALVAGE_MULT
      : 1;

  const rawCents =
    base * occupancyMult * timeMult * releaseMult * dowSlotMult * velocityMult * salvageMult;

  const floorCents = Math.max(1, Math.round(base * PRICE_FLOOR_MULT));
  const ceilingCents = Math.max(floorCents, Math.round(base * PRICE_CEILING_MULT));
  const clampedCents = clamp(rawCents, floorCents, ceilingCents);

  // clampedCents is guaranteed inside [floorCents, ceilingCents], but rounding it to the
  // nearest 25 cents can walk it back OUTSIDE that range by up to ~12 cents (e.g. a value
  // 1 cent above floorCents can round DOWN past floorCents). Left alone, that would make
  // "the final price respects the floor/ceiling" a lie the engine tells about itself. Fix
  // it by rounding the BOUNDS onto the same 25-cent grid first (floor up, ceiling down),
  // then re-clamping the rounded price onto those grid-aligned bounds — grid-to-grid
  // clamping cannot leave the grid, so the invariant holds exactly, not approximately.
  // A [floorCents, ceilingCents] window narrower than one grid step (only reachable at
  // sub-dollar base prices no real showtime would ever have) can contain no grid point at
  // all, so that case skips rounding rather than risk stepping outside a window too small
  // to round within — the floor/ceiling promise always wins over the cosmetic rounding.
  let finalCents: number;
  if (ceilingCents - floorCents < ROUND_TO_CENTS) {
    finalCents = clamp(Math.round(clampedCents), floorCents, ceilingCents);
  } else {
    const alignedFloor = Math.ceil(floorCents / ROUND_TO_CENTS) * ROUND_TO_CENTS;
    const alignedCeiling = Math.floor(ceilingCents / ROUND_TO_CENTS) * ROUND_TO_CENTS;
    const rounded = psychRound(clampedCents, alignedFloor);
    finalCents = clamp(rounded, alignedFloor, alignedCeiling);
  }

  return {
    factors: {
      zoneBaseCents,
      surchargeCents,
      occupancyMult,
      timeMult,
      releaseMult,
      dowSlotMult,
      velocityMult,
      salvageMult,
    },
    rawCents,
    floorCents,
    ceilingCents,
    wasClamped: rawCents < floorCents || rawCents > ceilingCents,
    finalCents,
  };
}
