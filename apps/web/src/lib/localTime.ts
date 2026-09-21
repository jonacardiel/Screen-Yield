const WEEKDAY_ORDER = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** 0=Sunday..6=Saturday for `iso` as experienced in `timeZone` — the pricing engine's
 * `dayOfWeek` input needs the auditorium's local weekday, not the viewer's own. */
export function localDayOfWeek(iso: string, timeZone: string): number {
  const short = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(
    new Date(iso),
  );
  const idx = WEEKDAY_ORDER.indexOf(short);
  return idx === -1 ? 0 : idx;
}

/** Calendar-day difference (showtime's local date minus the film's release date), for the
 * pricing engine's `daysSinceRelease`. Both dates are treated as plain calendar dates —
 * this is "how many days into the run is this showing", not a precise elapsed-time count. */
function utcMidnightFromYmd(ymd: string): number {
  const [year, month, day] = ymd.split("-").map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day); // Date.UTC's month is 0-indexed; the string's isn't
}

export function daysSinceRelease(
  showtimeIso: string,
  releaseDateIso: string,
  timeZone: string,
): number {
  const localDateStr = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(showtimeIso)); // YYYY-MM-DD
  const showtimeUtcMidnight = utcMidnightFromYmd(localDateStr);
  const releaseUtcMidnight = utcMidnightFromYmd(releaseDateIso);
  return Math.round((showtimeUtcMidnight - releaseUtcMidnight) / 86_400_000);
}

/** A human "in 3d 4h" / "in 45m" / "started" string for a future or past instant. */
export function relativeTimeLabel(iso: string, now: number): string {
  const diffMs = new Date(iso).getTime() - now;
  if (diffMs <= 0) return "started";
  const totalMin = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const minutes = totalMin % 60;
  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${minutes}m`;
  return `in ${minutes}m`;
}
