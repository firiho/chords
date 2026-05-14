"use client";

import { isBlackMidi, midiToXPercent } from "@/lib/play/piano-geometry";
import { normalizePitchClass } from "@/lib/music/note-names";
import { NOTE_NAMES_SHARP } from "@/lib/music/note-names";
import type { Tile } from "@/hooks/use-tile-game";

export type LaneKind = "correct" | "wrong" | "pending";

export type LitLane = { midi: number; kind: LaneKind };

type FallingTilesProps = {
  tiles: Tile[];
  currentTime: number;
  travelSec: number;
  /** MIDI notes currently being held — drives the column-lane glow */
  litNotes?: LitLane[];
  /** Render extra empty space at the bottom equal to this fraction (0-1) so tiles
   * have a small lead-in zone before hitting the line. */
  hitLineFromBottomPct?: number;
};

export function FallingTiles({
  tiles,
  currentTime,
  travelSec,
  litNotes = [],
  hitLineFromBottomPct = 0
}: FallingTilesProps) {
  return (
    <div className="tiles-stage">
      <div className="tiles-stage-grid" />
      <div className="tiles-stage-glow" />

      {litNotes.map(({ midi, kind }) => {
        const xPct = midiToXPercent(midi);
        if (xPct === null) return null;
        const isBlack = isBlackMidi(midi);
        const widthPct = isBlack ? 4.4 : 5.2;
        return (
          <div
            key={`lane-${midi}`}
            className={`tile-lane tile-lane-${kind}`}
            style={{ left: `${xPct}%`, width: `${widthPct}%` }}
          >
            <div className="tile-lane-halo" />
          </div>
        );
      })}

      {tiles.map((tile) => {
        // Hit tiles vanish immediately — the lane spotlight flashes green for feedback.
        if (tile.status === "hit") return null;
        if (tile.status === "missed") {
          const since = currentTime - (tile.targetTime + 0.18);
          if (since > 0.5) return null;
        }
        const progress = (currentTime - tile.spawnTime) / travelSec;
        if (progress < -0.05) return null; // not yet spawned
        if (progress > 1.4) return null; // long past the line

        const xPct = midiToXPercent(tile.midi);
        if (xPct === null) return null;

        const isBlack = isBlackMidi(tile.midi);
        const widthPct = isBlack ? 2.2 : 2.6;
        const yPct = (1 - hitLineFromBottomPct) * Math.min(progress, 1) * 100;
        const inHit = progress >= 1 && tile.status === "pending";

        const noteName = NOTE_NAMES_SHARP[normalizePitchClass(tile.midi)];

        return (
          <div
            key={tile.id}
            className={`tile tile-${tile.status} ${isBlack ? "tile-black" : "tile-white"} ${inHit ? "tile-in-hit" : ""}`}
            style={{
              left: `${xPct}%`,
              top: `${yPct}%`,
              width: `${widthPct}%`
            }}
          >
            <span className="tile-label">{noteName}</span>
          </div>
        );
      })}

      <div className="tiles-hit-line" />
    </div>
  );
}
