import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const FUTURE_SOON = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
const FUTURE_LATER = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();

vi.mock("@screen-yield/snapshot/films", () => ({
  default: [
    {
      tmdbId: 1,
      title: "Film With Poster",
      releaseDate: "2026-01-01",
      runtimeMin: 100,
      posterPath: "/poster.jpg",
      popularity: 10,
    },
    {
      tmdbId: 2,
      title: "Film Without Poster",
      releaseDate: "2026-02-02",
      runtimeMin: null,
      posterPath: null,
      popularity: 5,
    },
  ],
}));

vi.mock("@screen-yield/snapshot/showtimes", () => ({
  default: [
    {
      id: `meridian-downtown/hall-01@${FUTURE_LATER}`,
      auditoriumId: "meridian-downtown/hall-01",
      tmdbFilmId: 1,
      startsAtIso: FUTURE_LATER,
      localTime: "20:00",
      baseCents: 1500,
    },
    {
      id: `meridian-downtown/hall-01@${FUTURE_SOON}`,
      auditoriumId: "meridian-downtown/hall-01",
      tmdbFilmId: 2,
      startsAtIso: FUTURE_SOON,
      localTime: "17:00",
      baseCents: 1000,
    },
  ],
}));

vi.mock("@screen-yield/snapshot/meta", () => ({
  default: {
    generatedAt: new Date().toISOString(),
    tmdbAttribution:
      "This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.",
    filmCount: 2,
    showtimeCount: 2,
  },
}));

const { LandingPage } = await import("../src/pages/LandingPage");

describe("LandingPage", () => {
  it("renders a card for every film with an upcoming showtime, with a poster fallback for films with no image", () => {
    render(<LandingPage />);
    expect(screen.getByText("Film With Poster")).toBeTruthy();
    expect(screen.getByText("Film Without Poster")).toBeTruthy();

    const posterImg = screen.getByText("Film With Poster").closest("a")!.querySelector("img");
    expect(posterImg).toBeTruthy();

    const noPosterImg = screen.getByText("Film Without Poster").closest("a")!.querySelector("img");
    expect(noPosterImg).toBeNull();
  });

  it("links each card to its film's booking page", () => {
    render(<LandingPage />);
    const link = screen.getByText("Film With Poster").closest("a");
    expect(link?.getAttribute("href")).toBe("/film/1");
  });
});
