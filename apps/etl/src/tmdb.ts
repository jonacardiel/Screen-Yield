import type { Film } from "@screen-yield/schema";

const TMDB_BASE = "https://api.themoviedb.org/3";

/** Raw shape of the fields we actually read off a TMDB /movie/{now_playing,upcoming}
 * result — deliberately not the full TMDB response type, so a field we don't use
 * changing shape upstream can't break this client. */
interface TmdbMovieResult {
  id: number;
  title: string;
  release_date: string; // "" for some unreleased titles — filtered out below
  poster_path: string | null;
  popularity: number;
}

interface TmdbListResponse {
  page: number;
  total_pages: number;
  results: TmdbMovieResult[];
}

interface TmdbMovieDetail {
  runtime: number | null;
}

/** A tiny fixed delay between sequential requests — TMDB doesn't currently enforce a hard
 * rate limit on this endpoint class, but a handful of unhurried requests is the polite
 * default for a scheduled job that isn't latency-sensitive. */
async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function tmdbGet<T>(
  apiKey: string,
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "en-US");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url);
  if (!res.ok) {
    // Never interpolate the key into an error message — it's already redacted from this
    // URL object's string form isn't guaranteed, so log the path, not the full URL.
    throw new Error(`TMDB request failed: ${res.status} ${res.statusText} (${path})`);
  }
  return (await res.json()) as T;
}

async function fetchList(
  apiKey: string,
  endpoint: "now_playing" | "upcoming",
  pages: number,
): Promise<TmdbMovieResult[]> {
  const all: TmdbMovieResult[] = [];
  for (let page = 1; page <= pages; page += 1) {
    const data = await tmdbGet<TmdbListResponse>(apiKey, `/movie/${endpoint}`, {
      region: "US",
      page: String(page),
    });
    all.push(...data.results);
    if (page < data.total_pages && page < pages) await delay(150);
  }
  return all;
}

/**
 * Fetches now-playing + upcoming US theatrical releases, dedupes by id, drops anything
 * without a real release date, and trims to the minimal field set FilmSchema allows —
 * see the comment on FilmSchema for why that trimming is deliberate, not laziness.
 */
export async function fetchFilms(apiKey: string, pagesPerEndpoint = 2): Promise<Film[]> {
  const [nowPlaying, upcoming] = await Promise.all([
    fetchList(apiKey, "now_playing", pagesPerEndpoint),
    fetchList(apiKey, "upcoming", pagesPerEndpoint),
  ]);

  const byId = new Map<number, TmdbMovieResult>();
  for (const m of [...nowPlaying, ...upcoming]) {
    if (!m.release_date) continue; // TMDB includes some titles with no confirmed date
    if (!byId.has(m.id)) byId.set(m.id, m);
  }

  const withRuntime = await Promise.all(
    [...byId.values()].map(async (m) => {
      await delay(50);
      const runtime = await fetchRuntime(apiKey, m.id);
      const film: Film = {
        tmdbId: m.id,
        title: m.title,
        releaseDate: m.release_date,
        runtimeMin: runtime,
        posterPath: m.poster_path,
        popularity: m.popularity,
      };
      return film;
    }),
  );

  return withRuntime.sort((a, b) => b.popularity - a.popularity);
}

async function fetchRuntime(apiKey: string, tmdbId: number): Promise<number | null> {
  try {
    const detail = await tmdbGet<TmdbMovieDetail>(apiKey, `/movie/${tmdbId}`);
    return detail.runtime ?? null;
  } catch {
    // A single title's detail lookup failing shouldn't sink the whole ingest run — the
    // scheduler falls back to a default runtime (see schedule.ts) when this is null.
    return null;
  }
}
