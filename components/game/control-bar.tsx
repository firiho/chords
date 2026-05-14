type ControlBarProps = {
  onClear: () => void;
  onConnect: () => void | Promise<void>;
  onStart: () => void;
  onReset: () => void;
  phase: "idle" | "running" | "game-over";
};

export function ControlBar({ onClear, onConnect, onStart, onReset, phase }: ControlBarProps) {
  return (
    <div className="control-bar">
      <button className="button button-primary" onClick={onConnect}>
        Connect MIDI
      </button>
      <button className="button button-secondary" onClick={phase === "running" ? onReset : onStart}>
        {phase === "running" ? "Restart Run" : "Start Run"}
      </button>
      <button className="button button-ghost" onClick={onClear}>
        Clear Notes
      </button>
    </div>
  );
}
