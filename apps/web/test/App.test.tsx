import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../src/App";

describe("App", () => {
  it("renders the hall name and every seat in the layout", () => {
    render(<App />);
    expect(screen.getByText(/Hall 1 — IMAX/)).toBeTruthy();
    // 154 seats authored in packages/layouts/meridian-downtown/hall-01.json
    expect(document.querySelectorAll('rect[role="gridcell"]')).toHaveLength(154);
  });

  it("shows the price-breakdown placeholder before any seat is selected", () => {
    render(<App />);
    expect(screen.getByText(/Select a seat to see exactly how its price was calculated/)).toBeTruthy();
  });
});
