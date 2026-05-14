export const NOTE_NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const NOTE_NAMES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export function normalizePitchClass(value: number) {
  return ((value % 12) + 12) % 12;
}

export function pitchClassName(pitchClass: number, preferFlats = false) {
  const names = preferFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  return names[normalizePitchClass(pitchClass)];
}

export function midiNumberToNote(midi: number, preferFlats = false) {
  const pitchClass = normalizePitchClass(midi);
  const octave = Math.floor(midi / 12) - 1;
  return `${pitchClassName(pitchClass, preferFlats)}${octave}`;
}

export function uniquePitchClasses(activeNotes: number[]) {
  return [...new Set(activeNotes.map((note) => normalizePitchClass(note)))].sort((a, b) => a - b);
}
