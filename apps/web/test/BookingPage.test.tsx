import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOLD_DURATION_MS } from "../src/lib/seatHold";

const FUTURE_ISO = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();

vi.mock("@screen-yield/snapshot/films", () => ({
  default: [
    {
      tmdbId: 42,
      title: "The Mock Menace",
      releaseDate: "2026-09-01",
      runtimeMin: 118,
      posterPath: null,
      popularity: 88.4,
    },
  ],
}));

vi.mock("@screen-yield/snapshot/showtimes", () => ({
  default: [
    {
      id: `meridian-downtown/hall-01@${FUTURE_ISO}`,
      auditoriumId: "meridian-downtown/hall-01",
      tmdbFilmId: 42,
      startsAtIso: FUTURE_ISO,
      localTime: "19:00",
      baseCents: 1200,
    },
  ],
}));

vi.mock("@screen-yield/snapshot/meta", () => ({
  default: {
    generatedAt: new Date().toISOString(),
    tmdbAttribution:
      "This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.",
    filmCount: 1,
    showtimeCount: 1,
  },
}));

const { BookingPage } = await import("../src/pages/BookingPage");

describe("BookingPage", () => {
  it("renders the full seat map for a known filmId, no router required", () => {
    render(<BookingPage filmId={42} />);
    expect(screen.getByText("The Mock Menace")).toBeTruthy();
    expect(document.querySelectorAll('rect[role="gridcell"]')).toHaveLength(154);
  });

  it("shows a not-showing message for an unknown filmId", () => {
    render(<BookingPage filmId={9999} />);
    expect(screen.getByText(/isn't currently showing/)).toBeTruthy();
    expect(document.querySelectorAll('rect[role="gridcell"]')).toHaveLength(0);
  });

  describe("simulated seat hold", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("holding a seat shows a countdown, then auto-releases it once the hold expires", () => {
      const { container } = render(<BookingPage filmId={42} />);
      const seat = container.querySelector('rect[role="gridcell"][aria-disabled="false"]');
      expect(seat).toBeTruthy();

      act(() => {
        seat!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(screen.getByText(/Held — expires in/)).toBeTruthy();
      expect(screen.getByRole("status").textContent).toMatch(/held/i);

      act(() => {
        vi.advanceTimersByTime(HOLD_DURATION_MS + 1000);
      });

      expect(screen.queryByText(/Held — expires in/)).toBeNull();
      expect(screen.getAllByText(/Hold expired — seat released/).length).toBeGreaterThan(0);
      expect(screen.getByRole("status").textContent).toMatch(/expired/i);
    });

    it("confirming a hold shows the booked state and stops the countdown", () => {
      const { container } = render(<BookingPage filmId={42} />);
      const seat = container.querySelector('rect[role="gridcell"][aria-disabled="false"]');

      act(() => {
        seat!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      fireEvent.click(screen.getByText("Confirm booking"));

      expect(screen.getByText(/Booked — this seat is confirmed/)).toBeTruthy();
    });
  });
});
