import { describe, expect, it } from "vitest";
import { AuditoriumLayoutSchema, flattenSeats } from "../src/auditorium.js";

function minimalLayout(overrides: Record<string, unknown> = {}) {
  return {
    id: "meridian-downtown/hall-test",
    name: "Test Hall",
    format: "STANDARD",
    screen: { widthUnits: 30, curve: 0.1 },
    rows: [
      { label: "A", y: 0, zone: "STANDARD", seats: [{ n: 1, x: 0 }, { n: 2, x: 1 }] },
      { label: "B", y: 1, zone: "PREMIUM", seats: [{ n: 1, x: 0, kind: "ACCESSIBLE" }] },
    ],
    ...overrides,
  };
}

describe("AuditoriumLayoutSchema", () => {
  it("accepts a well-formed layout", () => {
    const result = AuditoriumLayoutSchema.safeParse(minimalLayout());
    expect(result.success).toBe(true);
  });

  it("rejects row labels I and O", () => {
    const withI = minimalLayout({
      rows: [{ label: "I", y: 0, zone: "STANDARD", seats: [{ n: 1, x: 0 }] }],
    });
    expect(AuditoriumLayoutSchema.safeParse(withI).success).toBe(false);
  });

  it("rejects duplicate row labels", () => {
    const dup = minimalLayout({
      rows: [
        { label: "A", y: 0, zone: "STANDARD", seats: [{ n: 1, x: 0 }] },
        { label: "A", y: 1, zone: "STANDARD", seats: [{ n: 1, x: 0 }] },
      ],
    });
    expect(AuditoriumLayoutSchema.safeParse(dup).success).toBe(false);
  });
});

describe("flattenSeats", () => {
  it("produces one flat seat per authored seat, with a computed seatId", () => {
    const layout = AuditoriumLayoutSchema.parse(minimalLayout());
    const seats = flattenSeats(layout);
    expect(seats).toHaveLength(3);
    expect(seats.map((s) => s.seatId)).toEqual(["A1", "A2", "B1"]);
  });

  it("marks only the smallest-y row as the front row", () => {
    const layout = AuditoriumLayoutSchema.parse(minimalLayout());
    const seats = flattenSeats(layout);
    expect(seats.filter((s) => s.isFrontRow).map((s) => s.seatId)).toEqual(["A1", "A2"]);
  });

  it("carries the seat kind through for accessible/companion seats", () => {
    const layout = AuditoriumLayoutSchema.parse(minimalLayout());
    const seats = flattenSeats(layout);
    const b1 = seats.find((s) => s.seatId === "B1");
    expect(b1?.kind).toBe("ACCESSIBLE");
    expect(seats.find((s) => s.seatId === "A1")?.kind).toBeUndefined();
  });
});
