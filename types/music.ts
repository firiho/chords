export type ChordMatch = {
  chordName: string;
  root: number;
  quality: string;
  score: number;
  intervals: number[];
  exact: boolean;
  extras: number[];
};

export type ChordDetectionResult = {
  primary: string;
  detail: string;
  matches: ChordMatch[];
  pitchClasses: number[];
  root: number | null;
  quality: string | null;
};

export type MidiInputSummary = {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
};

export type ChordQuality = {
  name: string;
  intervals: number[];
  score: number;
};
