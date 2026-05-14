"use client";

import { isBlackMidi, PLAY_LAYOUT, midiToXPercent } from "@/lib/play/piano-geometry";
import { normalizePitchClass } from "@/lib/music/note-names";

type PlayPianoProps = {
  activeNotes: number[];
  /** MIDI notes that are currently in their hit window — highlights the key to play */
  highlightedNotes?: number[];
};

export function PlayPiano({ activeNotes, highlightedNotes = [] }: PlayPianoProps) {
  const activeSet = new Set(activeNotes);
  const highlightSet = new Set(highlightedNotes);

  return (
    <div className="play-piano">
      <div className="play-piano-keys">
        {PLAY_LAYOUT.whites.map(({ midi, index }) => {
          const left = `${(index / PLAY_LAYOUT.totalWhites) * 100}%`;
          const width = `${(1 / PLAY_LAYOUT.totalWhites) * 100}%`;
          const pc = normalizePitchClass(midi);
          const octave = Math.floor(midi / 12) - 1;
          return (
            <div
              key={midi}
              className={`pkey-play pkey-play-white ${activeSet.has(midi) ? "pkey-play-active" : ""} ${highlightSet.has(midi) ? "pkey-play-hint" : ""}`}
              style={{ left, width }}
            >
              {pc === 0 && <span className="pkey-play-label">C{octave}</span>}
            </div>
          );
        })}
        {PLAY_LAYOUT.blacks.map(({ midi }) => {
          const xPct = midiToXPercent(midi);
          if (xPct === null) return null;
          const widthPct = (1 / PLAY_LAYOUT.totalWhites) * 100 * 0.6;
          return (
            <div
              key={midi}
              className={`pkey-play pkey-play-black ${activeSet.has(midi) ? "pkey-play-active" : ""} ${highlightSet.has(midi) ? "pkey-play-hint" : ""}`}
              style={{ left: `${xPct}%`, width: `${widthPct}%`, transform: "translateX(-50%)" }}
            />
          );
        })}
      </div>
    </div>
  );
}

void isBlackMidi;
