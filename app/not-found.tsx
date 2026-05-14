import Link from "next/link";

export const metadata = {
  title: "Chords | 404"
};

export default function NotFound() {
  return (
    <main className="not-found-shell">
      <div className="page-noise" />
      <div className="page-glow page-glow-a" />
      <div className="page-glow page-glow-b" />

      <div className="stage-overlay-card stage-overlay-card-ready not-found-card">
        <span className="not-found-eyebrow">Error · 404</span>
        <h1 className="overlay-title">Off the keyboard</h1>
        <p className="overlay-sub">
          That route isn&apos;t in this song. Wrong key, missing tile, or a chord
          we never wrote. Pick a way back in.
        </p>

        <nav className="not-found-links">
          <Link href="/" className="overlay-btn">Chord Runner</Link>
          <Link href="/play" className="overlay-btn">Play</Link>
          <Link href="/sounds" className="overlay-btn">Sounds</Link>
        </nav>
      </div>
    </main>
  );
}
