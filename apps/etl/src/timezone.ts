/**
 * Converts a wall-clock date/time in a given IANA timezone to the correct absolute UTC
 * instant, DST included — using only `Intl.DateTimeFormat`, which ships with Node's ICU
 * data, rather than pulling in a timezone library. This is the standard "guess and
 * correct" trick: interpret the wall-clock fields as if they were UTC, ask Intl what wall-
 * clock time that UTC instant actually renders as in the target zone, and shift by the
 * difference. One correction pass is exact everywhere except the ~1-hour "fall back"
 * window once a year where a wall-clock time is genuinely ambiguous — not worth a second
 * pass for a fictional theater's showtime schedule.
 */
export function zonedWallTimeToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guessUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(new Date(guessUtcMs)).map((p) => [p.type, p.value]),
  );
  const renderedHour = parts.hour === "24" ? 0 : Number(parts.hour); // midnight can format as "24"

  const renderedAsUtcMs = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    renderedHour,
    Number(parts.minute),
    Number(parts.second),
  );

  const driftMs = guessUtcMs - renderedAsUtcMs;
  return new Date(guessUtcMs + driftMs);
}

export function formatHHMM(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export interface LocalCalendarDate {
  year: number;
  month: number; // 1-12
  day: number;
}

/**
 * What calendar date is it RIGHT NOW in `timeZone`? Not necessarily the same as the
 * server's UTC calendar date — e.g. a run just after midnight UTC is still "yesterday
 * evening" in Los Angeles. The scheduler needs the theater's own "today", not the
 * ingest job's server's "today", or its last showtime of each local day can silently
 * land on the wrong side of a UTC date boundary.
 */
export function currentLocalCalendarDate(now: Date, timeZone: string): LocalCalendarDate {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(now).map((p) => [p.type, p.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

/** Adds `days` to a LocalCalendarDate by round-tripping through UTC-midnight arithmetic —
 * safe here because we only ever care about the DATE, never a wall-clock time near a DST
 * boundary, so there's no local-offset ambiguity to worry about. */
export function addDays(date: LocalCalendarDate, days: number): LocalCalendarDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}
