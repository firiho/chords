// Shared layout math for the /play piano + falling-tile stage.
// Both pieces use the same MIDI-to-x mapping so tiles align perfectly with keys.

import { normalizePitchClass } from "@/lib/music/note-names";

export const PLAY_START_MIDI = 24; // C1
export const PLAY_END_MIDI = 84; // C6

const BLACK_PCS = new Set([1, 3, 6, 8, 10]);

export type WhiteKey = { midi: number; index: number };
export type BlackKey = { midi: number; whiteBeforeIndex: number };

export type PianoLayout = {
  whites: WhiteKey[];
  blacks: BlackKey[];
  totalWhites: number;
};

function buildLayout(): PianoLayout {
  const whites: WhiteKey[] = [];
  const blacks: BlackKey[] = [];
  for (let midi = PLAY_START_MIDI; midi <= PLAY_END_MIDI; midi += 1) {
    const pc = normalizePitchClass(midi);
    if (BLACK_PCS.has(pc)) {
      blacks.push({ midi, whiteBeforeIndex: whites.length - 1 });
    } else {
      whites.push({ midi, index: whites.length });
    }
  }
  return { whites, blacks, totalWhites: whites.length };
}

export const PLAY_LAYOUT = buildLayout();

export function isBlackMidi(midi: number): boolean {
  return BLACK_PCS.has(normalizePitchClass(midi));
}

/**
 * Convert a MIDI note number to an x-position percentage across the play surface.
 * Returns `null` for notes outside the playable range.
 *
 * - White keys: centered on their column.
 * - Black keys: positioned on the seam between their two adjacent white keys.
 */
export function midiToXPercent(midi: number): number | null {
  const w = PLAY_LAYOUT.whites.find((x) => x.midi === midi);
  if (w) return ((w.index + 0.5) / PLAY_LAYOUT.totalWhites) * 100;
  const b = PLAY_LAYOUT.blacks.find((x) => x.midi === midi);
  if (b) return ((b.whiteBeforeIndex + 1) / PLAY_LAYOUT.totalWhites) * 100;
  return null;
}

export function midiToWidthPercent(midi: number): number {
  // Black keys are visually ~62% the width of white keys
  const isBlack = isBlackMidi(midi);
  const base = (1 / PLAY_LAYOUT.totalWhites) * 100;
  return isBlack ? base * 0.62 : base * 0.92;
}
