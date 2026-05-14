// Song format
// ------------------------------------------------------------------
// A song is a list of notes with `t` (start time in seconds) and `d`
// (duration in seconds). Loaded from MIDI files in /public/songs/.
// ------------------------------------------------------------------

import type { MidiSongDescriptor } from "@/lib/play/midi-loader";

export type SongNote = {
  midi: number;
  t: number; // start time in seconds
  d: number; // duration in seconds
};

export type Song = {
  id: string;
  title: string;
  bpm: number;
  notes: SongNote[];
  durationSec: number;
};

// =====================================================================
// MIDI songs in /public/songs/
// To add a song: drop the .mid file in there, then register it here.
// =====================================================================

export const SONG_FILES: MidiSongDescriptor[] = [
  {
    id: "game-of-thrones",
    title: "Game of Thrones",
    url: "/songs/gameofthrones.mid"
  },
  {
    id: "hotel-california",
    title: "Hotel California",
    url: "/songs/hotelcalifornia.mid"
  },
  {
    id: "family-guy",
    title: "Family Guy",
    url: "/songs/familyguy.mid"
  }
];

export type SongEntry = { kind: "midi"; descriptor: MidiSongDescriptor };

export const SONG_LIBRARY: SongEntry[] = SONG_FILES.map((descriptor) => ({
  kind: "midi",
  descriptor
}));

export function songLibraryTitle(entry: SongEntry): string {
  return entry.descriptor.title;
}

export function songLibraryId(entry: SongEntry): string {
  return entry.descriptor.id;
}

export function findLibraryEntry(id: string): SongEntry | undefined {
  return SONG_LIBRARY.find((e) => songLibraryId(e) === id);
}
