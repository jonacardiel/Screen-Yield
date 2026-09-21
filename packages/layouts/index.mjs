// Node-context loader for the full Meridian Cinemas hall roster — used by apps/etl (plain
// Node, not bundled). apps/web instead imports individual halls as static JSON via the
// per-hall subpath exports below (e.g. "@screen-yield/layouts/hall-01"), which is what lets
// Vite tree-shake/hash them as build assets; this loader reads the directory at runtime,
// which only makes sense in a Node process, not a bundled browser build.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AuditoriumLayoutSchema } from "@screen-yield/schema";

const dir = new URL("./meridian-downtown/", import.meta.url);
const files = readdirSync(fileURLToPath(dir)).filter((f) => f.endsWith(".json"));

export const auditoriums = files.map((file) => {
  const raw = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
  const result = AuditoriumLayoutSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid auditorium layout in ${file}: ${JSON.stringify(result.error.issues)}`);
  }
  return result.data;
});
