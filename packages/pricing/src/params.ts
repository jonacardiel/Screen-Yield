/**
 * Every tunable number the pricing engine uses, in one place, each with the reasoning
 * behind its value. Nothing in engine.ts should have a bare numeric literal — if a new
 * knob is needed, it goes here with a comment, the same discipline as data.py's
 * REGRESSION_GAMES constant in nfl-game-predictor.
 */

import type { Format, Slot, Zone } from "./types.js";

/** Seat-zone price multiplier, applied to the showtime's base price. */
export const ZONE_MULT: Record<Zone, number> = {
  STANDARD: 1.0,
  PREMIUM: 1.25,
  RECLINER: 1.4,
};

/** Extra discount for STANDARD seats in the front row(s) — steep viewing angle, worst
 * sightline in the house, genuinely worth less. Only ever applied on top of STANDARD;
 * a front-row PREMIUM/RECLINER seat, if one exists, is not discounted. */
export const FRONT_ROW_MULT = 0.85;

/** Flat per-seat surcharge (cents) for the auditorium's projection/sound format. */
export const FORMAT_SURCHARGE_CENTS: Record<Format, number> = {
  STANDARD: 0,
  IMAX: 600,
  DOLBY: 400,
  SEVENTY_MM: 500,
};

/**
 * Occupancy multiplier: 1 + ALPHA * occupancy^GAMMA.
 * GAMMA=2.5 makes this deliberately convex — a hall at 20% full barely moves the price,
 * but the last 20% of seats (the ones people actually fight over) get expensive fast.
 * This is the shape a bid-price revenue-management curve should have: cheap to fill,
 * expensive to guarantee.
 */
export const OCCUPANCY_ALPHA = 0.6;
export const OCCUPANCY_GAMMA = 2.5;

/**
 * Time-to-show multiplier: 1 + BETA * exp(-hoursToShow / TAU).
 * TAU=48 means the multiplier has decayed to ~37% of its max by 48h out and is nearly
 * gone by a week out — models the classic airline "booking curve" where late bookers
 * (business travelers; here, procrastinators) pay the premium. hoursToShow is clamped
 * to >= 0 before use so a showtime already in progress doesn't invert the curve.
 */
export const TIME_BETA = 0.35;
export const TIME_TAU_HOURS = 48;

/**
 * Release-window multiplier: 1 + DELTA * exp(-daysSinceRelease / LAMBDA).
 * LAMBDA=14 gives opening week (~days 0-7) most of the premium, decayed to background
 * by day 30 — matches how real theatrical demand front-loads around release.
 * daysSinceRelease is clamped to >= 0 before use (previews/early screenings don't get
 * a NEGATIVE premium from this term).
 */
export const RELEASE_DELTA = 0.25;
export const RELEASE_LAMBDA_DAYS = 14;

/**
 * Day-of-week x time-slot multiplier, index [dayOfWeek][slot], dayOfWeek 0=Sunday.
 * Directional, not fit to real data — the point is the SHAPE (weekday matinees
 * cheapest, Friday/Saturday prime most expensive), the pattern every multiplex pricing
 * sheet has used for decades. Slot is derived from localHour by classifySlot().
 */
export const DOW_SLOT_MULT: Record<number, Record<Slot, number>> = {
  0: { MATINEE: 0.95, TWILIGHT: 1.05, PRIME: 1.1, LATE: 1.0 }, // Sun
  1: { MATINEE: 0.8, TWILIGHT: 0.9, PRIME: 0.95, LATE: 0.85 }, // Mon
  2: { MATINEE: 0.8, TWILIGHT: 0.9, PRIME: 0.95, LATE: 0.85 }, // Tue
  3: { MATINEE: 0.82, TWILIGHT: 0.92, PRIME: 1.0, LATE: 0.88 }, // Wed
  4: { MATINEE: 0.85, TWILIGHT: 0.95, PRIME: 1.05, LATE: 0.95 }, // Thu
  5: { MATINEE: 1.0, TWILIGHT: 1.1, PRIME: 1.25, LATE: 1.15 }, // Fri
  6: { MATINEE: 1.05, TWILIGHT: 1.15, PRIME: 1.25, LATE: 1.2 }, // Sat
};

/** Hour-of-day boundaries used to classify localHour into a Slot. Upper bound exclusive. */
export const SLOT_BOUNDARIES: { end: number; slot: Slot }[] = [
  { end: 17, slot: "MATINEE" },
  { end: 19, slot: "TWILIGHT" },
  { end: 22, slot: "PRIME" },
  { end: 24, slot: "LATE" },
];

/**
 * Real-time demand-velocity surge: 1 + EPSILON * clamp(recentRate/baseRate - 1, 0, 2).
 * EPSILON=0.15 caps the pure "everyone is booking this RIGHT NOW" surge contribution at
 * 30% (when the clamp saturates at its max of 2) so it nudges rather than dominates.
 */
export const VELOCITY_EPSILON = 0.15;
export const VELOCITY_RATIO_CLAMP_MAX = 2;

/**
 * Last-minute salvage discount: if fewer than SALVAGE_HOURS_THRESHOLD remain AND
 * occupancy is below SALVAGE_OCCUPANCY_THRESHOLD, multiply by SALVAGE_MULT (<1). Real
 * revenue management dumps unsold perishable inventory rather than let it expire at $0 —
 * this is the newsvendor logic's other half from the surge logic above.
 */
export const SALVAGE_HOURS_THRESHOLD = 3;
export const SALVAGE_OCCUPANCY_THRESHOLD = 0.3;
export const SALVAGE_MULT = 0.75;

/** Hard bounds, expressed as a multiple of (zoneBaseCents + surchargeCents). Never breached. */
export const PRICE_FLOOR_MULT = 0.7;
export const PRICE_CEILING_MULT = 2.75;

/** Round to the nearest 25 cents, then nudge an exact dollar down 1 cent ($50.00 -> $49.99). */
export const ROUND_TO_CENTS = 25;
