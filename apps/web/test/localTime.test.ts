import { describe, expect, it } from "vitest";
import { daysSinceRelease, localDayOfWeek, relativeTimeLabel } from "../src/lib/localTime";

const LA = "America/Los_Angeles";

describe("localDayOfWeek", () => {
  it("resolves a known Friday-7pm-LA instant to weekday index 5", () => {
    // 2026-09-25T19:00 PDT (UTC-7) == 2026-09-26T02:00Z
    expect(localDayOfWeek("2026-09-26T02:00:00Z", LA)).toBe(5);
  });

  it("can differ from the UTC weekday near a date boundary", () => {
    // 2026-09-25T23:30 PDT is still Friday locally, but already Saturday in UTC.
    const iso = "2026-09-26T06:30:00Z"; // = 2026-09-25T23:30 PDT
    expect(new Date(iso).getUTCDay()).toBe(6); // UTC says Saturday
    expect(localDayOfWeek(iso, LA)).toBe(5); // LA still says Friday
  });
});

describe("daysSinceRelease", () => {
  it("regression: does not misread the month (Date.UTC takes a 0-indexed month)", () => {
    // A showtime on 2026-09-25 for a film released 2026-09-01 is 24 days into its run,
    // not ~24 days into some OTHER month — the bug this guards against silently added a
    // whole calendar month's worth of days to every non-January date.
    const showtimeIso = "2026-09-26T02:00:00Z"; // = 2026-09-25T19:00 PDT
    expect(daysSinceRelease(showtimeIso, "2026-09-01", LA)).toBe(24);
  });

  it("is zero on opening day", () => {
    const showtimeIso = "2026-09-02T02:00:00Z"; // = 2026-09-01T19:00 PDT
    expect(daysSinceRelease(showtimeIso, "2026-09-01", LA)).toBe(0);
  });

  it("handles a December-to-January release-to-showtime span across a year boundary", () => {
    const showtimeIso = "2026-01-08T03:00:00Z"; // = 2026-01-07T19:00 PST
    expect(daysSinceRelease(showtimeIso, "2025-12-25", LA)).toBe(13);
  });
});

describe("relativeTimeLabel", () => {
  const now = new Date("2026-09-25T12:00:00Z").getTime();

  it("formats a multi-day gap", () => {
    expect(relativeTimeLabel("2026-09-28T12:00:00Z", now)).toBe("in 3d 0h");
  });

  it("formats an hours-only gap", () => {
    expect(relativeTimeLabel("2026-09-25T15:30:00Z", now)).toBe("in 3h 30m");
  });

  it("formats a minutes-only gap", () => {
    expect(relativeTimeLabel("2026-09-25T12:20:00Z", now)).toBe("in 20m");
  });

  it("reports a past instant as started", () => {
    expect(relativeTimeLabel("2026-09-25T11:00:00Z", now)).toBe("started");
  });
});
