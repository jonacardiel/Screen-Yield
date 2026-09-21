import { useCallback, useEffect, useRef, useState } from "react";
import {
  HOLD_DURATION_MS,
  formatRemaining,
  holdDeadline,
  isExpired,
  msRemaining as computeMsRemaining,
} from "../lib/seatHold";

export type HoldStatus = "available" | "held" | "booked";

interface SeatHoldState {
  status: HoldStatus;
  seatId: string | null;
  deadline: number | null;
}

const INITIAL_STATE: SeatHoldState = { status: "available", seatId: null, deadline: null };

export interface UseSeatHoldResult {
  status: HoldStatus;
  heldSeatId: string | null;
  msRemaining: number;
  hold: (seatId: string) => void;
  cancel: () => void;
  confirm: () => void;
  reset: () => void;
  /** True for a few seconds right after a hold auto-expires, for a transient "released" banner. */
  justExpired: boolean;
  /** Plain-text status for an aria-live region — updated only on transitions, never per-tick. */
  announcement: string;
}

const WARNING_THRESHOLD_MS = 15_000;
const EXPIRED_BANNER_MS = 4_000;

/**
 * One hold slot at a time (this app models a single-seat checkout, not a multi-seat cart —
 * see ARCHITECTURE.md). Simulated entirely client-side: this is a labeled preview of the
 * real M4 backend (Postgres-backed, concurrency-safe), not an actual inventory lock.
 */
export function useSeatHold(): UseSeatHoldResult {
  const [state, setState] = useState<SeatHoldState>(INITIAL_STATE);
  const [msLeft, setMsLeft] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [justExpired, setJustExpired] = useState(false);
  const warnedRef = useRef(false);

  const hold = useCallback((seatId: string) => {
    const deadline = holdDeadline(Date.now());
    setState({ status: "held", seatId, deadline });
    setMsLeft(HOLD_DURATION_MS);
    warnedRef.current = false;
    setJustExpired(false);
    setAnnouncement(`Seat ${seatId} held for ${Math.round(HOLD_DURATION_MS / 1000)} seconds.`);
  }, []);

  const cancel = useCallback(() => {
    setState((prev) => {
      if (prev.status !== "held") return prev;
      setAnnouncement(`Hold on seat ${prev.seatId ?? ""} cancelled.`);
      return INITIAL_STATE;
    });
  }, []);

  // Unlike cancel(), this clears a "booked" state too — used when the showtime changes,
  // since a hold/booking only ever makes sense against the showtime it was made for.
  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    setJustExpired(false);
  }, []);

  const confirm = useCallback(() => {
    setState((prev) => {
      if (prev.status !== "held") return prev;
      setAnnouncement(`Seat ${prev.seatId ?? ""} booked.`);
      return { ...prev, status: "booked", deadline: null };
    });
  }, []);

  // Countdown tick, keyed off a wall-clock deadline rather than a decrementing counter, so
  // it's correct even if a throttled/backgrounded tab misses ticks — the next tick that does
  // fire just recomputes `deadline - now`, it never drifts. A visibilitychange listener
  // forces an immediate recompute on refocus, so an expiry that happened in the background
  // is caught instantly instead of waiting for the next scheduled tick.
  useEffect(() => {
    if (state.status !== "held" || state.deadline == null) return;
    const deadline = state.deadline;

    function tick() {
      const now = Date.now();
      const remaining = computeMsRemaining(deadline, now);
      setMsLeft(remaining);

      if (!warnedRef.current && remaining > 0 && remaining <= WARNING_THRESHOLD_MS) {
        warnedRef.current = true;
        setAnnouncement(`Hold expiring soon — ${formatRemaining(remaining)} left.`);
      }

      if (isExpired(deadline, now)) {
        setState(INITIAL_STATE);
        setAnnouncement("Hold expired — seat released.");
        setJustExpired(true);
      }
    }

    tick();
    const interval = setInterval(tick, 1000);
    function onVisibilityChange() {
      if (document.visibilityState === "visible") tick();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [state.status, state.deadline]);

  useEffect(() => {
    if (!justExpired) return;
    const timeout = setTimeout(() => setJustExpired(false), EXPIRED_BANNER_MS);
    return () => clearTimeout(timeout);
  }, [justExpired]);

  return {
    status: state.status,
    heldSeatId: state.seatId,
    msRemaining: msLeft,
    hold,
    cancel,
    confirm,
    reset,
    justExpired,
    announcement,
  };
}
