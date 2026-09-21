/**
 * Usage: TMDB_API_KEY=... node dist/ingest.js
 * (or `npm run ingest`, which reads apps/etl/.env locally via --env-file-if-exists — see
 * .env.example. In CI, TMDB_API_KEY comes from a GitHub Actions secret instead.)
 *
 * Fetches current/upcoming films from TMDB, allocates them into Meridian Cinemas'
 * showtime grid for the next DAYS_AHEAD days, validates the result against
 * @screen-yield/schema's SnapshotSchema, and writes it to packages/snapshot — the exact
 * files apps/web reads. Re-run daily (see .github/workflows/ingest.yml) so "the next 7
 * days" keeps sliding forward and TMDB's 6-month cache limit is never approached (see the
 * staleness check in ci.yml, which fails the build if this hasn't run in 90 days).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { auditoriums } from "@screen-yield/layouts";
import { SnapshotSchema } from "@screen-yield/schema";
import { fetchFilms } from "./tmdb.js";
import { buildSchedule, MERIDIAN_TIMEZONE } from "./schedule.js";
import { currentLocalCalendarDate } from "./timezone.js";

const TMDB_ATTRIBUTION =
  "This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.";

async function main() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.error(
      "TMDB_API_KEY is not set. Locally: put `TMDB_API_KEY=...` in apps/etl/.env " +
        "(see .env.example, gitignored). In CI: set the TMDB_API_KEY repository secret.",
    );
    process.exit(1);
  }

  console.log("Fetching now-playing + upcoming films from TMDB...");
  const films = await fetchFilms(apiKey);
  console.log(`  ${films.length} distinct films (deduped, dated, sorted by popularity)`);

  const today = currentLocalCalendarDate(new Date(), MERIDIAN_TIMEZONE);
  console.log(
    `Building the showtime grid from ${today.year}-${today.month}-${today.day} (Meridian local)...`,
  );
  const showtimes = buildSchedule(auditoriums, films, today);
  console.log(`  ${showtimes.length} showtimes across ${auditoriums.length} auditorium(s)`);

  const usedFilmIds = new Set(showtimes.map((s) => s.tmdbFilmId));
  const scheduledFilms = films.filter((f) => usedFilmIds.has(f.tmdbId));

  const snapshot = SnapshotSchema.parse({
    meta: {
      generatedAt: new Date().toISOString(),
      tmdbAttribution: TMDB_ATTRIBUTION,
      filmCount: scheduledFilms.length,
      showtimeCount: showtimes.length,
    },
    films: scheduledFilms, // only films that actually got a slot — no unused catalog noise
    showtimes,
  });

  const outDir = fileURLToPath(new URL("../../../packages/snapshot/", import.meta.url));
  await mkdir(outDir, { recursive: true });
  await writeFile(`${outDir}films.json`, JSON.stringify(snapshot.films, null, 2) + "\n");
  await writeFile(`${outDir}showtimes.json`, JSON.stringify(snapshot.showtimes, null, 2) + "\n");
  await writeFile(`${outDir}meta.json`, JSON.stringify(snapshot.meta, null, 2) + "\n");

  console.log(
    `Wrote snapshot: ${snapshot.films.length} films, ${snapshot.showtimes.length} showtimes -> ${outDir}`,
  );
}

main().catch((err) => {
  console.error("Ingest failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
