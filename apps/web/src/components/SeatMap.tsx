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
  /** The one seat currently held or booked (this app models a single hold slot, not a cart). */
  heldSeatId: string | null;
  /** True when `heldSeatId` is a confirmed booking rather than a still-counting-down hold. */
  isHeldSeatBooked: boolean;
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
  heldSeatId,
  isHeldSeatBooked,
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
  const screenCenterX = (bounds.minX + bounds.maxX) / 2;
  const screenHalfWidth = screen.widthUnits / 2;
  const screenSag = 1.5 * screen.curve; // how far the arc dips down at center
  const screenY = -2.4; // clears row A (top edge at -SEAT_H/2) instead of sitting on top of it

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
    if (seatId === heldSeatId && isHeldSeatBooked) return; // a confirmed booking is inert
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
      <defs>
        <radialGradient id="screen-glow" cx="50%" cy="0%" r="75%">
          <stop offset="0%" stopColor="var(--color-surge-cyan)" stopOpacity="0.08" />
          <stop offset="60%" stopColor="var(--color-surge-cyan)" stopOpacity="0.02" />
          <stop offset="100%" stopColor="var(--color-surge-cyan)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect
        x={bounds.minX}
        y={bounds.minY}
        width={bounds.maxX - bounds.minX}
        height={(bounds.maxY - bounds.minY) * 0.5}
        fill="url(#screen-glow)"
        aria-hidden="true"
        style={{ pointerEvents: "none" }}
      />
      <path
        d={`M ${screenCenterX - screenHalfWidth} ${screenY} Q ${screenCenterX} ${screenY + screenSag} ${screenCenterX + screenHalfWidth} ${screenY}`}
        stroke="var(--seatmap-screen-arc)"
        strokeWidth={0.15}
        fill="none"
        aria-hidden="true"
      />
      <text
        x={screenCenterX}
        y={screenY - 1}
        textAnchor="middle"
        fontSize={0.9}
        fill="var(--seatmap-screen-text)"
        aria-hidden="true"
      >
        SCREEN
      </text>

      {rows.map((row) => (
        <g key={row.label} role="row" aria-label={`Row ${row.label}`}>
          <text
            x={row.seats[0]!.x - SEAT_W}
            y={row.y + SEAT_H * 0.75}
            fontSize={0.9}
            fill="var(--seatmap-row-label)"
          >
            {row.label}
          </text>
          {row.seats.map((seat) => {
            const sold = isSold(seat.seatId);
            const isHeld = seat.seatId === heldSeatId;
            const booked = isHeld && isHeldSeatBooked;
            const held = isHeld && !isHeldSeatBooked;
            const priceCents = priceForSeat(seat);
            const statusLabel = sold
              ? "sold"
              : booked
                ? "booked, confirmed"
                : held
                  ? "held, expires soon"
                  : formatUsd(priceCents);
            const label = `Row ${seat.rowLabel} seat ${seat.seatNumber}, ${seat.zone.toLowerCase()}${
              seat.kind ? `, ${seat.kind.toLowerCase()}` : ""
            }, ${statusLabel}`;
            return (
              <g key={seat.seatId}>
                <rect
                  data-seat-id={seat.seatId}
                  role="gridcell"
                  tabIndex={seat.seatId === focusedSeatId ? 0 : -1}
                  aria-label={label}
                  aria-selected={isHeld}
                  aria-disabled={sold || booked}
                  x={seat.x - SEAT_W / 2}
                  y={seat.y - SEAT_H / 2}
                  width={SEAT_W}
                  height={SEAT_H}
                  rx={0.25}
                  fill={
                    sold
                      ? "var(--seat-sold)"
                      : booked
                        ? "var(--seat-selected)"
                        : held
                          ? "var(--seat-held)"
                          : ZONE_COLOR[seat.zone]
                  }
                  stroke={
                    seat.seatId === focusedSeatId ? "var(--seatmap-focus-ring)" : "transparent"
                  }
                  strokeWidth={0.12}
                  opacity={sold ? 0.5 : 1}
                  style={{
                    cursor: sold || booked ? "not-allowed" : "pointer",
                    transition:
                      "fill 150ms ease-out, opacity 150ms ease-out, filter 150ms ease-out",
                    animation: held ? "seat-pulse 1.5s ease-in-out infinite" : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (!sold && !booked) {
                      e.currentTarget.style.filter = "brightness(1.15)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!sold && !booked) {
                      e.currentTarget.style.filter = "brightness(1)";
                    }
                  }}
                />
                {booked && (
                  <text
                    x={seat.x}
                    y={seat.y + SEAT_H * 0.28}
                    textAnchor="middle"
                    fontSize={0.9}
                    fill="var(--color-surge-bg)"
                    aria-hidden="true"
                    style={{ pointerEvents: "none" }}
                  >
                    ✓
                  </text>
                )}
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}
