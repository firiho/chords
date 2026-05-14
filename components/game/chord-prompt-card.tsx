import type { ObstaclePrompt } from "@/types/game";

const accentClassMap = {
  lime: "accent-lime",
  orange: "accent-orange",
  sky: "accent-sky"
};

type ChordPromptCardProps = {
  holdProgress: number;
  prompt: ObstaclePrompt;
};

export function ChordPromptCard({ holdProgress, prompt }: ChordPromptCardProps) {
  return (
    <section className={`prompt-card ${accentClassMap[prompt.accent]}`}>
      <div className="prompt-label">Current Gate</div>
      <div className="prompt-name">{prompt.label}</div>
      <div className="prompt-copy">Hold the exact pitch-class shape as the obstacle reaches the gate.</div>
      <div className="meter">
        <div className="meter-fill" style={{ width: `${holdProgress * 100}%` }} />
      </div>
    </section>
  );
}
