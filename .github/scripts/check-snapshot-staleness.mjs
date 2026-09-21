#!/usr/bin/env node
// TMDB's API terms forbid caching their data for longer than 6 months (see the README's
// "Data & attribution" section). packages/snapshot is regenerated daily by ingest.yml, so
// under normal operation it's never more than a day old — this check exists purely to
// catch ingest.yml silently going dark (the exact failure mode nfl-game-predictor hit:
// GitHub disables a scheduled workflow after 60 days of repo inactivity). 90 days gives a
// wide safety margin before the 6-month legal limit while still catching a dead cron
// early enough to fix it.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MAX_AGE_DAYS = 90;

const metaPath = fileURLToPath(new URL("../../packages/snapshot/meta.json", import.meta.url));
const meta = JSON.parse(readFileSync(metaPath, "utf8"));

const generatedAt = new Date(meta.generatedAt);
if (Number.isNaN(generatedAt.getTime())) {
  console.error(`packages/snapshot/meta.json has an unparseable generatedAt: ${meta.generatedAt}`);
  process.exit(1);
}

const ageDays = (Date.now() - generatedAt.getTime()) / 86_400_000;
console.log(`Snapshot generated ${generatedAt.toISOString()} (${ageDays.toFixed(1)} days ago).`);

if (ageDays > MAX_AGE_DAYS) {
  console.error(
    `FAIL: snapshot is ${ageDays.toFixed(1)} days old, over the ${MAX_AGE_DAYS}-day limit. ` +
      `ingest.yml has likely stopped running — check its schedule and the last successful run.`,
  );
  process.exit(1);
}
