import { useMemo, useRef, useState } from "react";
import type { FlatSeat, Screen } from "@screen-yield/schema";

const SEAT_W = 1.6;
const SEAT_H = 1.2;
const PADDING = 2;

const ZONE_COLOR: Record<FlatSeat["zone"], string> = {
  STANDARD: "var(--zone-standard)",
  PREMIUM: "var(--zone-premium)",
  RECLINER: "var(--zone-recliner)",
};

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

interface SeatMapProps {
  seats: FlatSeat[];
  screen: Screen;
  priceForSeat: (seat: FlatSeat) => number;
  isSold: (seatId: string) => boolean;
  selectedSeatId: string | null;
  onSelectSeat: (seatId: string) => void;
}

/**
 * Renders the auditorium as one SVG with a single delegated click/keydown handler on the
 * root — not a listener per seat — so this stays fast even at IMAX-hall seat counts.
 * role="grid"/"row"/"gridcell" + roving tabindex + arrow-key navigation makes the whole
 * map usable from the keyboard alone, matching the accessibility model in the plan (§8).
 */
export function SeatMap({
  seats,
  screen,
  priceForSeat,
  isSold,
  selectedSeatId,
  onSelectSeat,
}: SeatMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [focusedSeatId, setFocusedSeatId] = useState<string>(seats[0]?.seatId ?? "");

  const rows = useMemo(() => {
    const byLabel = new Map<string, FlatSeat[]>();
    for (const seat of seats) {
      const list = byLabel.get(seat.rowLabel) ?? [];
      list.push(seat);
      byLabel.set(seat.rowLabel, list);
    }
    return [...byLabel.entries()]
      .map(([label, rowSeats]) => ({
        label,
        y: rowSeats[0]!.y,
        seats: [...rowSeats].sort((a, b) => a.x - b.x),
      }))
      .sort((a, b) => a.y - b.y);
  }, [seats]);

  const bounds = useMemo(() => {
    const xs = seats.map((s) => s.x);
    const ys = seats.map((s) => s.y);
    return {
      minX: Math.min(...xs) - PADDING - SEAT_W,
      maxX: Math.max(...xs) + PADDING + SEAT_W,
      minY: -PADDING - 3, // extra headroom for the screen glyph
      maxY: Math.max(...ys) + PADDING + SEAT_H,
    };
  }, [seats]);

  const viewBox = `${bounds.minX} ${bounds.minY} ${bounds.maxX - bounds.minX} ${bounds.maxY - bounds.minY}`;
  const screenHalfWidth = screen.widthUnits / 2;
  const screenSag = 1.5 * screen.curve; // how far the arc dips down at center

  function seatAt(id: string): FlatSeat | undefined {
    return seats.find((s) => s.seatId === id);
  }

  function moveFocus(dx: -1 | 0 | 1, dy: -1 | 0 | 1) {
    const current = seatAt(focusedSeatId);
    if (!current) return;
    const rowIdx = rows.findIndex((r) => r.label === current.rowLabel);
    if (dx !== 0) {
      const row = rows[rowIdx];
      if (!row) return;
      const idxInRow = row.seats.findIndex((s) => s.seatId === current.seatId);
      const nextIdx = idxInRow + dx;
      const next = row.seats[nextIdx];
      if (next) focus(next.seatId);
      return;
    }
    if (dy !== 0) {
      const nextRow = rows[rowIdx + dy];
      if (!nextRow) return;
      // Land on the seat nearest the current x position — row seat counts differ by zone.
      const nearest = nextRow.seats.reduce((best, s) =>
        Math.abs(s.x - current.x) < Math.abs(best.x - current.x) ? s : best,
      );
      focus(nearest.seatId);
    }
  }

  function focus(seatId: string) {
    setFocusedSeatId(seatId);
    requestAnimationFrame(() => {
      svgRef.current?.querySelector<SVGElement>(`[data-seat-id="${seatId}"]`)?.focus();
    });
  }

  function handleActivate(seatId: string) {
    if (isSold(seatId)) return;
    onSelectSeat(seatId);
  }

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    const el = (e.target as Element).closest<SVGElement>("[data-seat-id]");
    const seatId = el?.dataset.seatId;
    if (!seatId) return;
    // A mouse click also moves the roving-tabindex focus, so a click followed by arrow
    // keys continues from where the user just pointed rather than from a stale seat.
    setFocusedSeatId(seatId);
    handleActivate(seatId);
  }

  function handleKeyDown(e: React.KeyboardEvent<SVGSVGElement>) {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        moveFocus(1, 0);
        break;
      case "ArrowLeft":
        e.preventDefault();
        moveFocus(-1, 0);
        break;
      case "ArrowDown":
        e.preventDefault();
        moveFocus(0, 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveFocus(0, -1);
        break;
      case "Home": {
        e.preventDefault();
        const row = rows.find((r) => r.seats.some((s) => s.seatId === focusedSeatId));
        const first = row?.seats[0];
        if (first) focus(first.seatId);
        break;
      }
      case "End": {
        e.preventDefault();
        const row = rows.find((r) => r.seats.some((s) => s.seatId === focusedSeatId));
        const last = row?.seats.at(-1);
        if (last) focus(last.seatId);
        break;
      }
      case "Enter":
      case " ":
        e.preventDefault();
        handleActivate(focusedSeatId);
        break;
      default:
        break;
    }
  }

  return (
    <svg
      ref={svgRef}
      role="grid"
      aria-label="Auditorium seat map"
      viewBox={viewBox}
      className="w-full h-auto select-none"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <path
        d={`M ${-screenHalfWidth} 0 Q 0 ${screenSag} ${screenHalfWidth} 0`}
        stroke="#4b5563"
        strokeWidth={0.15}
        fill="none"
        aria-hidden="true"
      />
      <text
        x={0}
        y={-1.2}
        textAnchor="middle"
        fontSize={0.9}
        fill="#6b7280"
        aria-hidden="true"
      >
        SCREEN
      </text>

      {rows.map((row) => (
        <g key={row.label} role="row" aria-label={`Row ${row.label}`}>
          <text x={row.seats[0]!.x - SEAT_W} y={row.y + SEAT_H * 0.75} fontSize={0.9} fill="#9ca3af">
            {row.label}
          </text>
          {row.seats.map((seat) => {
            const sold = isSold(seat.seatId);
            const selected = seat.seatId === selectedSeatId;
            const priceCents = priceForSeat(seat);
            const label = `Row ${seat.rowLabel} seat ${seat.seatNumber}, ${seat.zone.toLowerCase()}${
              seat.kind ? `, ${seat.kind.toLowerCase()}` : ""
            }, ${sold ? "sold" : formatUsd(priceCents)}`;
            return (
              <rect
                key={seat.seatId}
                data-seat-id={seat.seatId}
                role="gridcell"
                tabIndex={seat.seatId === focusedSeatId ? 0 : -1}
                aria-label={label}
                aria-selected={selected}
                aria-disabled={sold}
                x={seat.x - SEAT_W / 2}
                y={seat.y - SEAT_H / 2}
                width={SEAT_W}
                height={SEAT_H}
                rx={0.25}
                fill={sold ? "var(--seat-sold)" : selected ? "var(--seat-selected)" : ZONE_COLOR[seat.zone]}
                stroke={seat.seatId === focusedSeatId ? "#f9fafb" : "transparent"}
                strokeWidth={0.12}
                opacity={sold ? 0.5 : 1}
                style={{ cursor: sold ? "not-allowed" : "pointer" }}
              />
            );
          })}
        </g>
      ))}
    </svg>
  );
}
