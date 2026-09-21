import { describe, expect, it } from "vitest";
import { formatHHMM, zonedWallTimeToUtc } from "../src/timezone.js";

describe("zonedWallTimeToUtc", () => {
  it("converts a summer (PDT, UTC-7) LA wall-clock time correctly", () => {
    const utc = zonedWallTimeToUtc(2026, 7, 1, 19, 0, "America/Los_Angeles");
    expect(utc.toISOString()).toBe("2026-07-02T02:00:00.000Z");
  });

  it("converts a winter (PST, UTC-8) LA wall-clock time correctly", () => {
    const utc = zonedWallTimeToUtc(2026, 1, 1, 19, 0, "America/Los_Angeles");
    expect(utc.toISOString()).toBe("2026-01-02T03:00:00.000Z");
  });

  it("is correct on both sides of the spring-forward DST boundary (2026-03-08 in the US)", () => {
    const before = zonedWallTimeToUtc(2026, 3, 7, 19, 0, "America/Los_Angeles"); // still PST
    const after = zonedWallTimeToUtc(2026, 3, 9, 19, 0, "America/Los_Angeles"); // now PDT
    expect(before.toISOString()).toBe("2026-03-08T03:00:00.000Z");
    expect(after.toISOString()).toBe("2026-03-10T02:00:00.000Z");
  });
});

describe("formatHHMM", () => {
  it("zero-pads hour and minute", () => {
    expect(formatHHMM(9, 5)).toBe("09:05");
    expect(formatHHMM(19, 30)).toBe("19:30");
  });
});
