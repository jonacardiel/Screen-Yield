import { describe, expect, it } from "vitest";
import { seatSaleRank } from "../src/lib/demoOccupancy";

/**
 * Regression test for a real bug found while eyeballing the seat map: plain FNV-1a on
 * short, near-identical seat IDs ("A1".."A14") sharing a long constant salt prefix under-
 * mixes and clusters an entire row's ranks within a narrow band, so moving the occupancy
 * slider filled or emptied whole rows at once instead of scattering plausibly. This test
 * would have caught it — it fails on the pre-fix implementation.
 */
describe("seatSaleRank", () => {
  it("spreads a single row's ranks across most of [0, 1), not a narrow band", () => {
    const rowIds = Array.from({ length: 14 }, (_, i) => `A${i + 1}`);
    const ranks = rowIds.map((id) => seatSaleRank(id));
    const spread = Math.max(...ranks) - Math.min(...ranks);
    // A clustered hash produced a spread under 0.1 for every row; a healthy one should
    // comfortably cover more than half the [0,1) range across 14 samples.
    expect(spread).toBeGreaterThan(0.5);
  });

  it("is deterministic for the same seat ID", () => {
    expect(seatSaleRank("H12")).toBe(seatSaleRank("H12"));
  });

  it("returns values within [0, 1)", () => {
    for (const id of ["A1", "N8", "M14", "Z99"]) {
      const rank = seatSaleRank(id);
      expect(rank).toBeGreaterThanOrEqual(0);
      expect(rank).toBeLessThan(1);
    }
  });

  it("gives different seats different ranks (no accidental collisions in this sample)", () => {
    const ids = Array.from({ length: 50 }, (_, i) => `X${i}`);
    const ranks = new Set(ids.map((id) => seatSaleRank(id)));
    expect(ranks.size).toBe(ids.length);
  });
});
