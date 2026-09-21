/**
 * Pure helpers for the client-side simulated seat hold — a labeled preview of what a real
 * M4 backend would do (see the README's roadmap), not an actual inventory lock. No timers,
 * no React, no I/O: everything here is a function of a deadline timestamp.
 */

export const HOLD_DURATION_MS = 90_000; // 90s — long enough to feel real, short enough to watch expire

export function holdDeadline(now: number): number {
  return now + HOLD_DURATION_MS;
}

export function msRemaining(deadline: number, now: number): number {
  return Math.max(0, deadline - now);
}

export function isExpired(deadline: number, now: number): boolean {
  return now >= deadline;
}

/** Formats remaining milliseconds as "m:ss", e.g. 47_000 -> "0:47". */
export function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
