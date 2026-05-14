import { midiNumberToNote, pitchClassName, uniquePitchClasses } from "@/lib/music/note-names";
import type { MidiInputSummary } from "@/types/music";

type MidiMonitorProps = {
  activeNotes: number[];
  inputs: MidiInputSummary[];
  status: string;
  preferFlats: boolean;
};

export function MidiMonitor({ activeNotes, inputs, status, preferFlats }: MidiMonitorProps) {
  const noteNames = activeNotes.map((note) => midiNumberToNote(note, preferFlats));
  const pitchClasses = uniquePitchClasses(activeNotes).map((pitchClass) => pitchClassName(pitchClass, preferFlats));

  return (
    <section className="monitor-grid">
      <article className="info-card">
        <div className="card-label">MIDI status</div>
        <p>{status}</p>
        <div className="input-list">
          {inputs.length ? (
            inputs.map((input) => (
              <div key={input.id} className="input-pill">
                <strong>{input.name}</strong>
                <span>{input.manufacturer}</span>
              </div>
            ))
          ) : (
            <div className="input-pill muted">No inputs listed yet.</div>
          )}
        </div>
      </article>

      <article className="info-card">
        <div className="card-label">Pressed notes</div>
        <p>{noteNames.length ? noteNames.join("  ") : "None"}</p>
        <div className="card-label top-gap">Pitch classes</div>
        <p>{pitchClasses.length ? pitchClasses.join("  ") : "None"}</p>
      </article>
    </section>
  );
}
