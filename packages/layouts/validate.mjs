#!/usr/bin/env node
// Validates every authored layout against AuditoriumLayoutSchema. Run after
// generate-hall.mjs, and in CI, so a bad layout fails loudly instead of rendering wrong.
import { readdirSync, readFileSync } from "node:fs";
import { AuditoriumLayoutSchema, flattenSeats } from "@screen-yield/schema";

const dir = new URL("./meridian-downtown/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

let failed = false;
for (const file of files) {
  const raw = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
  const result = AuditoriumLayoutSchema.safeParse(raw);
  if (!result.success) {
    failed = true;
    console.error(`FAIL ${file}:`, result.error.issues);
    continue;
  }
  const seats = flattenSeats(result.data);
  const ada = seats.filter((s) => s.kind);
  const byZone = Object.groupBy(seats, (s) => s.zone);
  console.log(
    `OK   ${file}: ${seats.length} seats, ${ada.length} ADA (${ada.map((s) => `${s.seatId}:${s.kind}`).join(", ")}), ` +
      `zones: ${Object.entries(byZone)
        .map(([z, xs]) => `${z}=${xs?.length}`)
        .join(" ")}`,
  );
}
process.exit(failed ? 1 : 0);
