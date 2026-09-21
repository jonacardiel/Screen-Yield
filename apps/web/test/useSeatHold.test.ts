import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSeatHold } from "../src/hooks/useSeatHold";
import { HOLD_DURATION_MS } from "../src/lib/seatHold";

describe("useSeatHold", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts a hold and auto-expires it after the hold duration", () => {
    const { result } = renderHook(() => useSeatHold());

    act(() => {
      result.current.hold("A1");
    });
    expect(result.current.status).toBe("held");
    expect(result.current.heldSeatId).toBe("A1");
    expect(result.current.msRemaining).toBeGreaterThan(0);

    act(() => {
      vi.advanceTimersByTime(HOLD_DURATION_MS + 1000);
    });

    expect(result.current.status).toBe("available");
    expect(result.current.heldSeatId).toBeNull();
    expect(result.current.justExpired).toBe(true);
    expect(result.current.announcement).toMatch(/expired/i);
  });

  it("cancels a hold before it expires", () => {
    const { result } = renderHook(() => useSeatHold());

    act(() => {
      result.current.hold("B2");
    });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    act(() => {
      result.current.cancel();
    });

    expect(result.current.status).toBe("available");
    expect(result.current.heldSeatId).toBeNull();

    // A cancelled hold shouldn't still be running a timer that later marks it "expired".
    act(() => {
      vi.advanceTimersByTime(HOLD_DURATION_MS);
    });
    expect(result.current.justExpired).toBe(false);
  });

  it("confirming a hold stops the countdown and marks the seat booked", () => {
    const { result } = renderHook(() => useSeatHold());

    act(() => {
      result.current.hold("C3");
    });
    act(() => {
      result.current.confirm();
    });

    expect(result.current.status).toBe("booked");
    expect(result.current.heldSeatId).toBe("C3");

    // A booking doesn't expire — advancing well past the hold duration changes nothing.
    act(() => {
      vi.advanceTimersByTime(HOLD_DURATION_MS * 2);
    });
    expect(result.current.status).toBe("booked");
    expect(result.current.justExpired).toBe(false);
  });

  it("reset() clears a booked seat too, unlike cancel()", () => {
    const { result } = renderHook(() => useSeatHold());

    act(() => {
      result.current.hold("D4");
    });
    act(() => {
      result.current.confirm();
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("available");
    expect(result.current.heldSeatId).toBeNull();
  });
});
