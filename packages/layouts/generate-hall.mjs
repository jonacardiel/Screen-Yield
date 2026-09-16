#!/usr/bin/env node
/**
 * Authors one auditorium layout JSON, matching AuditoriumLayoutSchema
 * (packages/schema/src/auditorium.ts). Not a crawler or a scraper — this generates
 * FICTIONAL geometry from a hand-picked spec below; every number here is authored, not
 * observed. Kept as a script rather than typed-out-by-hand JSON because "13 rows of
 * individually hand-placed seat coordinates" is exactly the kind of repetitive transcription
 * a script does more reliably than a human does by pasting the same shape 130 times.
 *
 * Usage: node generate-hall.mjs <spec-name> > <hall-id>.json
 */
import { writeFileSync } from "node:fs";

// Row letters skip I and O (they read as 1 and 0) — real theater convention, and
// AuditoriumLayoutSchema rejects them if this generator ever got it wrong.
const ROW_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("");

/**
 * @param {{
 *   id: string, name: string, format: string, screenWidthUnits: number, screenCurve: number,
 *   bands: { rows: number, zone: string, seatsPerRow: number }[],
 *   seatSpacing: number, rowSpacing: number, aisleAfterSeat: number, aisleGapUnits: number,
 * }} spec
 */
function buildLayout(spec) {
  const rows = [];
  let rowIndex = 0;
  let adaPlacedInBand = new Set();

  for (const band of spec.bands) {
    for (let i = 0; i < band.rows; i += 1) {
      const label = ROW_LETTERS[rowIndex];
      if (!label) throw new Error("ran out of row letters — shrink the spec");
      const seats = [];
      for (let n = 1; n <= band.seatsPerRow; n += 1) {
        const aisleShift = n > spec.aisleAfterSeat ? spec.aisleGapUnits : 0;
        const seat = { n, x: Math.round((n - 1) * spec.seatSpacing + aisleShift) };

        // Disperse one ADA pair (companion + accessible) per zone band, on the band's
        // first row, aisle-adjacent — dispersed across pricing tiers, never clustered in
        // one corner, matching the plan's accessibility requirement.
        const bandKey = band.zone;
        if (i === 0 && n === spec.aisleAfterSeat && !adaPlacedInBand.has(bandKey)) {
          seat.kind = "ACCESSIBLE";
        } else if (i === 0 && n === spec.aisleAfterSeat + 1 && !adaPlacedInBand.has(bandKey)) {
          seat.kind = "COMPANION";
          adaPlacedInBand.add(bandKey);
        }
        seats.push(seat);
      }
      rows.push({
        label,
        y: rowIndex * spec.rowSpacing,
        zone: band.zone,
        seats,
        gaps: [spec.aisleAfterSeat],
      });
      rowIndex += 1;
    }
  }

  return {
    id: spec.id,
    name: spec.name,
    format: spec.format,
    screen: { widthUnits: spec.screenWidthUnits, curve: spec.screenCurve },
    rows,
  };
}

const SPECS = {
  "hall-01": {
    id: "meridian-downtown/hall-01",
    name: "Hall 1 — IMAX",
    format: "IMAX",
    screenWidthUnits: 26,
    screenCurve: 0.25, // IMAX halls run a more pronounced screen curve than a standard flat screen
    seatSpacing: 2,
    rowSpacing: 2,
    aisleAfterSeat: 7,
    aisleGapUnits: 2,
    bands: [
      // Front rows: worst sightline in an IMAX hall (screen fills too much of the visual
      // field this close) — STANDARD tier, and row A additionally gets the front-row
      // discount computed by flattenSeats (it's the single smallest-y row).
      { rows: 5, zone: "STANDARD", seatsPerRow: 14 },
      // Sweet spot: roughly two-thirds back, centered — the recommended IMAX viewing
      // distance band (screen fills the recommended field of view without craning).
      { rows: 5, zone: "PREMIUM", seatsPerRow: 12 },
      // Back rows: recliners. Real large-format/Dolby halls commonly put recliners at
      // the rear, where there's depth for the mechanism and an unobstructed sightline
      // over the premium section in front.
      { rows: 3, zone: "RECLINER", seatsPerRow: 8 },
    ],
  },
};

const specName = process.argv[2];
const spec = SPECS[specName];
if (!spec) {
  console.error(`Unknown spec "${specName}". Known specs: ${Object.keys(SPECS).join(", ")}`);
  process.exit(1);
}

const layout = buildLayout(spec);
const outPath = new URL(`./meridian-downtown/${specName}.json`, import.meta.url);
writeFileSync(outPath, JSON.stringify(layout, null, 2) + "\n");
console.error(`wrote ${outPath.pathname}`);
