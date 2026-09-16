import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { price } from "../src/engine.js";
import type { Format, PriceContext, Zone } from "../src/types.js";

const zoneArb: fc.Arbitrary<Zone> = fc.constantFrom("STANDARD", "PREMIUM", "RECLINER");
const formatArb: fc.Arbitrary<Format> = fc.constantFrom("STANDARD", "IMAX", "DOLBY", "SEVENTY_MM");

/** Deliberately wide, including pathological inputs (negative hours, tiny base prices,
 * out-of-range day-of-week) — a pricing engine's invariants must hold everywhere, not
 * just on the happy path a demo would exercise. */
const ctxArb: fc.Arbitrary<PriceContext> = fc.record({
  basePriceCents: fc.integer({ min: 1, max: 10_000 }),
  zone: zoneArb,
  isFrontRow: fc.boolean(),
  format: formatArb,
  occupancy: fc.double({ min: 0, max: 1, noNaN: true }),
  hoursToShow: fc.double({ min: -100, max: 500, noNaN: true }),
  daysSinceRelease: fc.double({ min: -30, max: 400, noNaN: true }),
  dayOfWeek: fc.integer({ min: -10, max: 20 }),
  localHour: fc.integer({ min: 0, max: 23 }),
  demandVelocityRatio: fc.double({ min: 0, max: 5, noNaN: true }),
});

describe("price() — property-based invariants (fast-check)", () => {
  it("never breaches its own floor or ceiling, for any input", () => {
    fc.assert(
      fc.property(ctxArb, (ctx) => {
        const result = price(ctx);
        expect(result.finalCents).toBeGreaterThanOrEqual(result.floorCents);
        expect(result.finalCents).toBeLessThanOrEqual(result.ceilingCents);
      }),
    );
  });

  it("always returns a positive integer number of cents", () => {
    fc.assert(
      fc.property(ctxArb, (ctx) => {
        const result = price(ctx);
        expect(Number.isInteger(result.finalCents)).toBe(true);
        expect(result.finalCents).toBeGreaterThan(0);
      }),
    );
  });

  it("is deterministic", () => {
    fc.assert(
      fc.property(ctxArb, (ctx) => {
        expect(price(ctx)).toEqual(price({ ...ctx }));
      }),
    );
  });

  it("is monotonic non-decreasing in occupancy, holding everything else fixed", () => {
    fc.assert(
      fc.property(
        ctxArb,
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (ctx, occA, occB) => {
          const [lo, hi] = occA <= occB ? [occA, occB] : [occB, occA];
          const priceLo = price({ ...ctx, occupancy: lo }).finalCents;
          const priceHi = price({ ...ctx, occupancy: hi }).finalCents;
          expect(priceLo).toBeLessThanOrEqual(priceHi);
        },
      ),
    );
  });

  it("has factors that multiply back to rawCents", () => {
    fc.assert(
      fc.property(ctxArb, (ctx) => {
        const { factors, rawCents } = price(ctx);
        const recomputed =
          (factors.zoneBaseCents + factors.surchargeCents) *
          factors.occupancyMult *
          factors.timeMult *
          factors.releaseMult *
          factors.dowSlotMult *
          factors.velocityMult *
          factors.salvageMult;
        expect(recomputed).toBeCloseTo(rawCents, 6);
      }),
    );
  });
});
