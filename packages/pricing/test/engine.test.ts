import { describe, expect, it } from "vitest";
import { classifySlot, price, psychRound } from "../src/engine.js";
import type { PriceContext } from "../src/types.js";

/** A representative, fully-specified context — tests override only what they're probing. */
function baseCtx(overrides: Partial<PriceContext> = {}): PriceContext {
  return {
    basePriceCents: 1200,
    zone: "STANDARD",
    isFrontRow: false,
    format: "STANDARD",
    occupancy: 0.3,
    hoursToShow: 72,
    daysSinceRelease: 20,
    dayOfWeek: 3,
    localHour: 14,
    demandVelocityRatio: 1.0,
    ...overrides,
  };
}

describe("classifySlot", () => {
  it("maps hours to the documented slots, with PRIME starting at 19:00 not before", () => {
    expect(classifySlot(9)).toBe("MATINEE");
    expect(classifySlot(16)).toBe("MATINEE");
    expect(classifySlot(17)).toBe("TWILIGHT");
    expect(classifySlot(18)).toBe("TWILIGHT");
    expect(classifySlot(19)).toBe("PRIME"); // the worked example depends on this exact boundary
    expect(classifySlot(21)).toBe("PRIME");
    expect(classifySlot(22)).toBe("LATE");
    expect(classifySlot(23)).toBe("LATE");
  });
});

describe("psychRound", () => {
  it("rounds to the nearest 25 cents", () => {
    expect(psychRound(4962)).toBe(4950);
    expect(psychRound(4963)).toBe(4975);
  });

  it("nudges an exact dollar down one cent", () => {
    expect(psychRound(5000)).toBe(4999);
    expect(psychRound(1000)).toBe(999);
  });

  it("does not nudge below the given floor", () => {
    // 5000 would normally become 4999, but a floor of 5000 forbids that.
    expect(psychRound(5000, 5000)).toBe(5000);
  });
});

describe("price() — worked example (README §6 / plan §6)", () => {
  it("prices a Friday-7pm IMAX seat at 72% occupancy, 6h out, day 4 of release, 1.8x demand to exactly $49.50, capped", () => {
    const result = price(
      baseCtx({
        basePriceCents: 1200,
        format: "IMAX",
        occupancy: 0.72,
        hoursToShow: 6,
        daysSinceRelease: 4,
        dayOfWeek: 5, // Friday
        localHour: 19,
        demandVelocityRatio: 1.8,
      }),
    );

    expect(result.factors.zoneBaseCents).toBe(1200);
    expect(result.factors.surchargeCents).toBe(600);
    expect(result.factors.dowSlotMult).toBe(1.25);
    expect(result.ceilingCents).toBe(4950); // 1800 * 2.75
    expect(result.wasClamped).toBe(true); // raw ~4954 > ceiling
    expect(result.finalCents).toBe(4950); // = $49.50, the cap visibly binding
  });
});

describe("price() — invariants", () => {
  const ctx = baseCtx();

  it("is monotonic non-decreasing in occupancy, all else equal", () => {
    const low = price({ ...ctx, occupancy: 0.1 }).finalCents;
    const mid = price({ ...ctx, occupancy: 0.5 }).finalCents;
    const high = price({ ...ctx, occupancy: 0.95 }).finalCents;
    expect(low).toBeLessThanOrEqual(mid);
    expect(mid).toBeLessThanOrEqual(high);
  });

  it("never breaches its own floor or ceiling", () => {
    const result = price(ctx);
    expect(result.finalCents).toBeGreaterThanOrEqual(result.floorCents);
    expect(result.finalCents).toBeLessThanOrEqual(result.ceilingCents);
  });

  it("is always a positive integer number of cents", () => {
    const result = price(ctx);
    expect(Number.isInteger(result.finalCents)).toBe(true);
    expect(result.finalCents).toBeGreaterThan(0);
  });

  it("is deterministic: identical context in, identical breakdown out", () => {
    const a = price(ctx);
    const b = price({ ...ctx });
    expect(a).toEqual(b);
  });

  it("has factors that multiply back to rawCents", () => {
    const result = price(ctx);
    const { factors } = result;
    const recomputed =
      (factors.zoneBaseCents + factors.surchargeCents) *
      factors.occupancyMult *
      factors.timeMult *
      factors.releaseMult *
      factors.dowSlotMult *
      factors.velocityMult *
      factors.salvageMult;
    expect(recomputed).toBeCloseTo(result.rawCents, 6);
  });
});
