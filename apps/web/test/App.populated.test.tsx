import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// vi.mock calls are hoisted above imports by vitest, so this replaces the snapshot data
// BEFORE App.tsx's module-level `z.array(FilmSchema).parse(...)` calls run — exercising
// the populated path (landing grid, booking page, live pricing) without depending on a
// real ingest run or network access.
const FUTURE_ISO = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(); // ~26h out

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

const { default: App } = await import("../src/App");

describe("App — populated snapshot (mocked)", () => {
  it("shows the film on the landing page, and clicking through reveals the full seat map and TMDB attribution footer", async () => {
    history.pushState(null, "", "/");
    render(<App />);
    expect(screen.getByText("The Mock Menace")).toBeTruthy();
    // Not on the booking page yet — no seat grid until a film is opened.
    expect(document.querySelectorAll('rect[role="gridcell"]')).toHaveLength(0);

    fireEvent.click(screen.getByText("The Mock Menace"));

    expect(await screen.findByText(/Released 2026-09-01/)).toBeTruthy();
    expect(document.querySelectorAll('rect[role="gridcell"]')).toHaveLength(154);
    expect(
      screen.getByText(/uses TMDB and the TMDB APIs but is not endorsed, certified/),
    ).toBeTruthy();
  });

  it("computes a live price once a seat is selected", async () => {
    history.pushState(null, "", "/film/42");
    const { container } = render(<App />);
    const seat = container.querySelector('rect[role="gridcell"][aria-disabled="false"]');
    expect(seat).toBeTruthy();
    seat!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    // "You pay" only renders once a breakdown exists
    expect(await screen.findByText("You pay")).toBeTruthy();
  });
});
