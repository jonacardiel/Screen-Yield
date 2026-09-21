import { Link, Route, Switch } from "wouter";
import { LandingPage } from "./pages/LandingPage";
import { BookingPage } from "./pages/BookingPage";
import { TMDB_ATTRIBUTION, meta, MERIDIAN_TIMEZONE } from "./lib/snapshot";

export default function App() {
  return (
    <div className="min-h-screen bg-surge-bg text-surge-text flex flex-col relative">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(34,211,238,0.06), transparent 60%)," +
            "linear-gradient(var(--color-surge-bg), var(--color-surge-bg))",
        }}
      />
      <header className="border-b border-surge-border px-6 py-4">
        <Link
          href="/"
          className="inline-flex flex-wrap items-baseline gap-x-2 transition-opacity duration-150 hover:opacity-80"
        >
          <span className="font-mono text-2xl font-semibold tracking-tight">
            <span className="text-surge-text">screen</span>
            <span className="text-surge-cyan">-yield</span>
          </span>
          <span className="text-surge-text-muted text-sm font-normal">· Meridian Cinemas</span>
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6 flex-1 w-full">
        <Switch>
          <Route path="/film/:id">{(params) => <BookingPageRoute id={params.id} />}</Route>
          <Route path="/">
            <LandingPage />
          </Route>
        </Switch>
      </main>

      <Footer />
    </div>
  );
}

function BookingPageRoute({ id }: { id: string }) {
  const filmId = Number(id);
  return <BookingPage filmId={filmId} />;
}

function Footer() {
  return (
    <footer className="border-t border-surge-border px-6 py-4 text-xs text-surge-text-faint space-y-1">
      <p>
        Every price is computed live by{" "}
        <code className="text-surge-text-faint">@screen-yield/pricing</code> from each real
        showtime's actual date, time, and days-since-release.
      </p>
      <p>{TMDB_ATTRIBUTION}</p>
      <p>
        Theaters, halls, and showtimes are entirely fictional (Meridian Cinemas) — film data last
        refreshed{" "}
        {new Date(meta.generatedAt).toLocaleString("en-US", { timeZone: MERIDIAN_TIMEZONE })}.
      </p>
    </footer>
  );
}
