import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Explicitly mocked to an empty snapshot rather than relying on packages/snapshot's real
// on-disk state (which a local `npm run ingest` run mutates) — this exercises the "zero
// data" path deterministically, independent of whatever the checkout currently holds.
vi.mock("@screen-yield/snapshot/films", () => ({ default: [] }));
vi.mock("@screen-yield/snapshot/showtimes", () => ({ default: [] }));
vi.mock("@screen-yield/snapshot/meta", () => ({
  default: {
    generatedAt: new Date().toISOString(),
    tmdbAttribution:
      "This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.",
    filmCount: 0,
    showtimeCount: 0,
  },
}));

const { default: App } = await import("../src/App");

describe("App — empty snapshot", () => {
  it("shows the empty-snapshot guidance instead of crashing or rendering a fake showtime", () => {
    history.pushState(null, "", "/");
    render(<App />);
    expect(screen.getByText(/No upcoming showtimes in the snapshot/)).toBeTruthy();
    expect(screen.getByText(/npm run ingest --workspace=@screen-yield\/etl/)).toBeTruthy();
  });
});
