import type { GameSnapshot } from "@/types/game";

type StatusPanelProps = {
  detectedChord: string;
  detail: string;
  phase: GameSnapshot["phase"];
  preferFlats: boolean;
  score: number;
  level: number;
  streak: number;
  onToggleNaming: () => void;
};

export function StatusPanel({
  detectedChord,
  detail,
  phase,
  preferFlats,
  score,
  level,
  streak,
  onToggleNaming
}: StatusPanelProps) {
  return (
    <section className="status-grid">
      <article className="info-card spotlight">
        <div className="card-label">Detected chord</div>
        <div className="detected-value">{detectedChord}</div>
        <p>{detail}</p>
      </article>

      <article className="info-card">
        <div className="card-label">Game stats</div>
        <div className="stats-row">
          <span>Score</span>
          <strong>{score}</strong>
        </div>
        <div className="stats-row">
          <span>Streak</span>
          <strong>{streak}</strong>
        </div>
        <div className="stats-row">
          <span>Level</span>
          <strong>{level}</strong>
        </div>
        <div className="stats-row">
          <span>State</span>
          <strong>{phase.replace("-", " ")}</strong>
        </div>
      </article>

      <article className="info-card">
        <div className="card-label">Naming</div>
        <p>{preferFlats ? "Flat spellings enabled" : "Sharp spellings enabled"}</p>
        <button className="button button-outline full-width" onClick={onToggleNaming}>
          {preferFlats ? "Use sharps" : "Use flats"}
        </button>
      </article>
    </section>
  );
}
