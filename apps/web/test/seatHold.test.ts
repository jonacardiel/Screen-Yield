import { describe, expect, it } from "vitest";
import {
  HOLD_DURATION_MS,
  formatRemaining,
  holdDeadline,
  isExpired,
  msRemaining,
} from "../src/lib/seatHold";

describe("seatHold pure helpers", () => {
  it("holdDeadline offsets by the fixed hold duration", () => {
    expect(holdDeadline(1000)).toBe(1000 + HOLD_DURATION_MS);
  });

  it("msRemaining is the gap to the deadline, clamped at zero", () => {
    expect(msRemaining(10_000, 3_000)).toBe(7_000);
    expect(msRemaining(3_000, 10_000)).toBe(0); // already past — never negative
  });

  it("isExpired is true once now reaches the deadline, inclusive", () => {
    expect(isExpired(10_000, 9_999)).toBe(false);
    expect(isExpired(10_000, 10_000)).toBe(true);
    expect(isExpired(10_000, 10_001)).toBe(true);
  });

  it("formatRemaining renders m:ss with zero-padded seconds", () => {
    expect(formatRemaining(90_000)).toBe("1:30");
    expect(formatRemaining(47_000)).toBe("0:47");
    expect(formatRemaining(5_000)).toBe("0:05");
    expect(formatRemaining(0)).toBe("0:00");
  });

  it("formatRemaining rounds up sub-second remainders so it never shows 0:00 while time is left", () => {
    expect(formatRemaining(400)).toBe("0:01");
  });
});
