import { z } from "zod";

/**
 * A film, sourced from TMDB and trimmed to the minimal fields this app actually displays
 * or schedules with — not a mirror of TMDB's full response. TMDB's API terms forbid
 * caching their data past 6 months and forbid redistributing it as a dataset; keeping this
 * shape deliberately thin (no overview, no cast, no full image set) is part of staying
 * inside "using the API to power a product" rather than "redistributing their catalog".
 */
export const FilmSchema = z.object({
  /** TMDB's own movie id — used as our primary key too, so there's one id, not two. */
  tmdbId: z.number().int().positive(),
  title: z.string().min(1),
  /** ISO date (YYYY-MM-DD), theatrical release date in TMDB's `release_date` field. */
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  runtimeMin: z.number().int().positive().nullable(),
  /** TMDB's raw poster_path (e.g. "/abc123.jpg"), NOT a downloaded/hosted image — the web
   * app hotlinks this from image.tmdb.org. Storing the binary would be redistribution. */
  posterPath: z.string().nullable(),
  /** TMDB's popularity score at ingest time — drives the scheduler's slot allocation. */
  popularity: z.number().nonnegative(),
});
export type Film = z.infer<typeof FilmSchema>;

export const ShowtimeSchema = z.object({
  id: z.string().min(1), // `${auditoriumId}@${startsAtIso}`
  auditoriumId: z.string().min(1), // matches AuditoriumLayout.id
  tmdbFilmId: z.number().int().positive(),
  /** Absolute instant, ISO 8601 with offset — the source of truth for "hours to show". */
  startsAtIso: z.string().datetime({ offset: true }),
  /** Wall-clock local time in the theater's timezone, "HH:MM", for display only. */
  localTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  baseCents: z.number().int().positive(),
});
export type Showtime = z.infer<typeof ShowtimeSchema>;

export const IngestMetaSchema = z.object({
  generatedAt: z.string().datetime({ offset: true }),
  /** Required verbatim by TMDB's API terms whenever their data is displayed — z.literal
   * so a typo here fails validation instead of silently shipping wrong legal text. */
  tmdbAttribution: z.literal(
    "This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.",
  ),
  filmCount: z.number().int().nonnegative(),
  showtimeCount: z.number().int().nonnegative(),
});
export type IngestMeta = z.infer<typeof IngestMetaSchema>;

export const SnapshotSchema = z
  .object({
    meta: IngestMetaSchema,
    films: z.array(FilmSchema),
    showtimes: z.array(ShowtimeSchema),
  })
  .refine(
    (snapshot) => {
      const filmIds = new Set(snapshot.films.map((f) => f.tmdbId));
      return snapshot.showtimes.every((s) => filmIds.has(s.tmdbFilmId));
    },
    { message: "Every showtime.tmdbFilmId must reference a film present in this snapshot." },
  );
export type Snapshot = z.infer<typeof SnapshotSchema>;
