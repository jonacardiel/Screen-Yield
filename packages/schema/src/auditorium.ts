import { z } from "zod";
import type { Format as PricingFormat, Zone as PricingZone } from "@screen-yield/pricing";

/**
 * zod enums re-declaring the pricing package's Zone/Format literal unions. Duplicated
 * rather than imported because zod needs its own runtime representation — the type-level
 * assertions right below make it impossible for the two to silently drift apart; a change
 * to one without the other fails `npm run typecheck`, not a runtime surprise.
 */
export const ZoneSchema = z.enum(["STANDARD", "PREMIUM", "RECLINER"]);
export const FormatSchema = z.enum(["STANDARD", "IMAX", "DOLBY", "SEVENTY_MM"]);

type _AssertZoneMatches = [PricingZone] extends [z.infer<typeof ZoneSchema>]
  ? [z.infer<typeof ZoneSchema>] extends [PricingZone]
    ? true
    : never
  : never;
type _AssertFormatMatches = [PricingFormat] extends [z.infer<typeof FormatSchema>]
  ? [z.infer<typeof FormatSchema>] extends [PricingFormat]
    ? true
    : never
  : never;
// If either schema drifts from the pricing package's types, one of these fails to
// typecheck ("Type 'never' is not assignable to type 'true'") — that's the whole point.
const _zoneAssertion: _AssertZoneMatches = true;
const _formatAssertion: _AssertFormatMatches = true;
void _zoneAssertion;
void _formatAssertion;

/** A seat's accessibility attribute. Orthogonal to `zone` (its pricing tier) — see the
 * comment on Zone in @screen-yield/pricing for why accessible seats are never a separate
 * pricing tier. Undefined means an ordinary seat. */
export const SeatKindSchema = z.enum(["ACCESSIBLE", "COMPANION"]).optional();

export const RowSeatSchema = z.object({
  /** Seat number within the row, as printed on the seat back. Not necessarily contiguous
   * — a wheelchair bay can consume the space of 2-3 numbered seats. */
  n: z.number().int().positive(),
  /** Horizontal position in layout units, for rendering. */
  x: z.number(),
  kind: SeatKindSchema,
});

export const RowSchema = z.object({
  /** Row letter as posted in the auditorium. Real auditoriums skip I and O (read as 1/0) —
   * enforced by AuditoriumLayoutSchema's refine below, not here, so a single bad row is a
   * clear top-level validation error rather than a cryptic array-index one. */
  label: z.string().min(1).max(2),
  /** Vertical position in layout units, front-to-back. */
  y: z.number(),
  zone: ZoneSchema,
  seats: z.array(RowSeatSchema).min(1),
  /** Seat numbers *after* which there is an aisle gap, for rendering spacing only. */
  gaps: z.array(z.number().int()).optional(),
});

export const ScreenSchema = z.object({
  /** Screen width in the same layout units as row/seat x-coordinates. */
  widthUnits: z.number().positive(),
  /** 0 = flat screen, higher = more pronounced curve (IMAX/large-format halls curve). */
  curve: z.number().min(0).max(1),
});

export const AuditoriumLayoutSchema = z
  .object({
    /** `"<theater-slug>/<hall-slug>"`, e.g. "meridian-downtown/hall-01". */
    id: z.string().min(1),
    name: z.string().min(1),
    format: FormatSchema,
    screen: ScreenSchema,
    rows: z.array(RowSchema).min(1),
  })
  .refine((layout) => layout.rows.every((r) => !/^[IO]$/i.test(r.label)), {
    message: "Row labels must skip I and O (they read as 1 and 0) — real theater convention.",
  })
  .refine(
    (layout) => {
      const labels = layout.rows.map((r) => r.label.toUpperCase());
      return new Set(labels).size === labels.length;
    },
    { message: "Row labels must be unique within an auditorium." },
  );

export type Zone = z.infer<typeof ZoneSchema>;
export type Format = z.infer<typeof FormatSchema>;
export type SeatKind = NonNullable<z.infer<typeof SeatKindSchema>>;
export type RowSeat = z.infer<typeof RowSeatSchema>;
export type Row = z.infer<typeof RowSchema>;
export type Screen = z.infer<typeof ScreenSchema>;
export type AuditoriumLayout = z.infer<typeof AuditoriumLayoutSchema>;

/** A single flattened seat, denormalized out of its row for rendering/iteration. */
export interface FlatSeat {
  seatId: string; // `${rowLabel}${seatNumber}`, e.g. "H12"
  rowLabel: string;
  seatNumber: number;
  x: number;
  y: number;
  zone: Zone;
  kind: SeatKind | undefined;
  isFrontRow: boolean;
}

/** Flatten an AuditoriumLayout's rows into a seat list. The front row is the row with the
 * smallest `y` — computed, not authored, so it can't drift from the row data. */
export function flattenSeats(layout: AuditoriumLayout): FlatSeat[] {
  const minY = Math.min(...layout.rows.map((r) => r.y));
  return layout.rows.flatMap((row) =>
    row.seats.map((seat) => ({
      seatId: `${row.label}${seat.n}`,
      rowLabel: row.label,
      seatNumber: seat.n,
      x: seat.x,
      y: row.y,
      zone: row.zone,
      kind: seat.kind,
      isFrontRow: row.y === minY,
    })),
  );
}
