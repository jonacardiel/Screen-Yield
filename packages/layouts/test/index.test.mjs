import { describe, expect, it } from "vitest";
import { auditoriums } from "../index.mjs";

describe("auditoriums (index.mjs Node loader)", () => {
  it("loads at least the hall-01 layout, already schema-validated", () => {
    expect(auditoriums.length).toBeGreaterThanOrEqual(1);
    const hall01 = auditoriums.find((a) => a.id === "meridian-downtown/hall-01");
    expect(hall01).toBeTruthy();
    expect(hall01.format).toBe("IMAX");
  });

  it("every loaded auditorium has a unique id", () => {
    const ids = auditoriums.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
