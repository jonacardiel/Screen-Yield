/** Shared vocabulary for the pricing engine. Kept here (not imported from @screen-yield/schema)
 * so this package stays genuinely dependency-free — schema re-exports these instead. */

/** Pricing tier a seat is sold under. Orthogonal to accessibility: an ACCESSIBLE seat is a
 * physical attribute of a specific STANDARD or PREMIUM seat, not its own tier — real assembly-
 * seating ADA rules require accessible seats be priced the same as the equivalent seat around
 * them, never a special (and never a premium) rate. */
export type Zone = "STANDARD" | "PREMIUM" | "RECLINER";

/** Auditorium projection/sound format, each with its own flat surcharge. */
export type Format = "STANDARD" | "IMAX" | "DOLBY" | "SEVENTY_MM";

export type Slot = "MATINEE" | "TWILIGHT" | "PRIME" | "LATE";

/**
 * Everything the engine needs to price one seat at one instant. No Date.now(), no I/O —
 * every time-relative value is precomputed and passed in, so price() is pure and
 * identical results always come from identical inputs (see the determinism invariant).
 */
export interface PriceContext {
  /** The showtime's base price for a STANDARD seat, in cents. */
  basePriceCents: number;
  zone: Zone;
  /** True only for a STANDARD seat in the auditorium's front-most row(s). */
  isFrontRow: boolean;
  format: Format;
  /** Fraction of the auditorium sold, in [0, 1]. */
  occupancy: number;
  /** Hours remaining until showtime. May be negative for a showtime already in progress. */
  hoursToShow: number;
  /** Days since the film's release date. May be negative for a preview/early screening. */
  daysSinceRelease: number;
  /** 0 = Sunday .. 6 = Saturday, in the theater's local timezone. */
  dayOfWeek: number;
  /** Local hour of the showtime, 0-23, used to classify the time slot. */
  localHour: number;
  /** Ratio of the current booking rate to this showtime's typical baseline rate (1.0 = normal). */
  demandVelocityRatio: number;
}

/** Every multiplier that fired, so the UI can show its work — this IS the "receipts" panel. */
export interface PriceFactors {
  zoneBaseCents: number;
  surchargeCents: number;
  occupancyMult: number;
  timeMult: number;
  releaseMult: number;
  dowSlotMult: number;
  velocityMult: number;
  salvageMult: number;
}

export interface PriceBreakdown {
  factors: PriceFactors;
  /** (zoneBaseCents + surchargeCents) * product of every multiplier, before clamping/rounding. */
  rawCents: number;
  floorCents: number;
  ceilingCents: number;
  /** True if rawCents fell outside [floorCents, ceilingCents] and was clamped. */
  wasClamped: boolean;
  /** The price actually charged: clamp(raw, floor, ceiling), then psychologically rounded. */
  finalCents: number;
}
