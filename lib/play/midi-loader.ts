import { Midi, type Track } from "@tonejs/midi";

import type { Song, SongNote } from "@/lib/play/songs";

export type MidiSongDescriptor = {
  id: string;
  title: string;
  url: string;
  /** Optional MIDI offset applied to every note (use to drop the pitch into range) */
  transpose?: number;
  /** Multiplier on every t/d (used at load time — also exists as a runtime slider) */
  speed?: number;
  /**
   * Explicit list of track indices to include. If omitted, the loader auto-picks
   * a melody track and a chord/accompaniment track and ignores the rest.
   */
  tracks?: number[];
};

const PLAYABLE_MIN_MIDI = 24; // C1
const PLAYABLE_MAX_MIDI = 84; // C6

function clampIntoRange(midi: number): number {
  let value = midi;
  while (value > PLAYABLE_MAX_MIDI) value -= 12;
  while (value < PLAYABLE_MIN_MIDI) value += 12;
  return value;
}

type TrackStats = {
  track: Track;
  avgPitch: number;
  polyphony: number; // 0–1: fraction of attacks that are chord stacks
  noteCount: number;
};

function describeTrack(track: Track): TrackStats | null {
  if (track.notes.length === 0) return null;
  const avgPitch = track.notes.reduce((s, n) => s + n.midi, 0) / track.notes.length;

  // Attack groups: notes starting within 30 ms count as one attack
  const sorted = [...track.notes].sort((a, b) => a.time - b.time);
  let polyAttacks = 0;
  let totalAttacks = 0;
  let i = 0;
  while (i < sorted.length) {
    let count = 1;
    while (i + count < sorted.length && sorted[i + count].time - sorted[i].time < 0.03) {
      count += 1;
    }
    if (count >= 2) polyAttacks += 1;
    totalAttacks += 1;
    i += count;
  }
  const polyphony = polyAttacks / Math.max(1, totalAttacks);

  return { track, avgPitch, polyphony, noteCount: track.notes.length };
}

/**
 * Pick at most two tracks: a high-pitched melody (mostly monophonic) and a
 * chord/accompaniment (lots of polyphony, mid-register). Everything else is
 * dropped to keep the tile board sane.
 */
function autoPickTracks(midi: Midi): Track[] {
  const candidates = midi.tracks
    .filter((t) => t.channel !== 9 && t.notes.length > 0)
    .map(describeTrack)
    .filter((s): s is TrackStats => s !== null);

  if (candidates.length === 0) return [];
  if (candidates.length === 1) return [candidates[0].track];

  // Melody score — high pitch + low polyphony wins
  const sortedForMelody = [...candidates].sort(
    (a, b) => b.avgPitch - a.avgPitch - (b.polyphony - a.polyphony) * 25
  );
  const melody = sortedForMelody[0].track;

  // Chord score — high polyphony first, then mid-register preference
  const sortedForChord = candidates
    .filter((s) => s.track !== melody)
    .sort((a, b) => b.polyphony * 60 + b.noteCount * 0.05 - (a.polyphony * 60 + a.noteCount * 0.05));
  const chord = sortedForChord[0]?.track;

  return chord ? [melody, chord] : [melody];
}

/**
 * Convert a parsed MIDI into our Song format. Filters to a melody + chord track
 * pair by default, keeps simultaneous notes for real chord stacks, octave-shifts
 * out-of-range notes into the playable window, and dedupes unison doubling.
 */
export async function loadMidiAsSong(descriptor: MidiSongDescriptor): Promise<Song> {
  const resp = await fetch(descriptor.url);
  if (!resp.ok) throw new Error(`Failed to fetch ${descriptor.url}: ${resp.status}`);
  const buffer = await resp.arrayBuffer();
  const midi = new Midi(buffer);

  const speed = descriptor.speed ?? 1;
  const transpose = descriptor.transpose ?? 0;

  // Choose tracks: explicit indices win; otherwise auto-pick melody + chord
  const chosen: Track[] = descriptor.tracks
    ? descriptor.tracks
        .map((idx) => midi.tracks[idx])
        .filter((t): t is Track => Boolean(t && t.notes.length > 0))
    : autoPickTracks(midi);

  if (chosen.length === 0) {
    throw new Error(`No playable tracks in ${descriptor.url}`);
  }

  const allNotes = chosen.flatMap((t) => t.notes);
  const sorted = [...allNotes].sort((a, b) => a.time - b.time || a.midi - b.midi);

  const firstStart = sorted[0]?.time ?? 0;

  // Dedupe: same midi within 10 ms is one event
  const DEDUPE_MS = 0.01;
  type Raw = { midi: number; time: number; duration: number };
  const reduced: Raw[] = [];
  for (const n of sorted) {
    const shifted: Raw = {
      midi: clampIntoRange(n.midi + transpose),
      time: n.time,
      duration: n.duration
    };
    const dup = reduced.find(
      (r) => r.midi === shifted.midi && Math.abs(r.time - shifted.time) < DEDUPE_MS
    );
    if (dup) {
      if (shifted.duration > dup.duration) dup.duration = shifted.duration;
      continue;
    }
    reduced.push(shifted);
  }

  const notes: SongNote[] = reduced.map((n) => ({
    midi: n.midi,
    t: (n.time - firstStart) / speed,
    d: Math.max(0.05, n.duration / speed)
  }));

  const durationSec = notes.reduce((max, n) => Math.max(max, n.t + n.d), 0);

  return {
    id: descriptor.id,
    title: descriptor.title,
    bpm: Math.round((midi.header.tempos[0]?.bpm ?? 120) / speed),
    notes,
    durationSec
  };
}
