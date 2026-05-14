import { CHORD_QUALITIES } from "@/lib/music/chord-qualities";
import { pitchClassName, uniquePitchClasses } from "@/lib/music/note-names";
import type { ChordDetectionResult } from "@/types/music";

function intervalsFromRoot(pitchClasses: number[], root: number) {
  return pitchClasses.map((pitchClass) => (pitchClass - root + 12) % 12).sort((a, b) => a - b);
}

function arraysEqual(a: number[], b: number[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function isSubset(needed: number[], actual: number[]) {
  return needed.every((interval) => actual.includes(interval));
}

function extraIntervals(actual: number[], expected: number[]) {
  return actual.filter((interval) => !expected.includes(interval));
}

function getBass(activeNotes: number[]) {
  if (!activeNotes.length) {
    return null;
  }

  return ((Math.min(...activeNotes) % 12) + 12) % 12;
}

export function detectChord(activeNotes: number[], preferFlats = false): ChordDetectionResult {
  const pitchClasses = uniquePitchClasses(activeNotes);
  const bass = getBass(activeNotes);

  if (pitchClasses.length === 0) {
    return {
      primary: "",
      detail: "",
      matches: [],
      pitchClasses,
      root: pitchClasses[0] ?? null,
      quality: null
    };
  }

  if (pitchClasses.length === 1) {
    return {
      primary: pitchClassName(pitchClasses[0], preferFlats),
      detail: "Single note",
      matches: [],
      pitchClasses,
      root: pitchClasses[0] ?? null,
      quality: null
    };
  }

  const matches = [];

  for (const root of pitchClasses) {
    const actualIntervals = intervalsFromRoot(pitchClasses, root);

    for (const quality of CHORD_QUALITIES) {
      const expected = [...quality.intervals].sort((a, b) => a - b);
      const exact = arraysEqual(actualIntervals, expected);
      const subset = isSubset(expected, actualIntervals);

      if (!exact && !subset) {
        continue;
      }

      const extras = extraIntervals(actualIntervals, expected);
      let score = quality.score;

      if (exact) score += 25;
      if (root === bass) score += 8;
      if (quality.intervals.length === pitchClasses.length) score += 12;
      if (quality.name.includes("sus") && actualIntervals.includes(5)) score += 4;
      if (quality.name.includes("9") && actualIntervals.includes(2)) score += 4;
      if (quality.name === "" && pitchClasses.length > 3) score -= 25;
      if (quality.name === "m" && pitchClasses.length > 3) score -= 25;
      score -= extras.length * 12;

      const rootName = pitchClassName(root, preferFlats);

      matches.push({
        chordName: `${rootName}${quality.name}`,
        root,
        quality: quality.name || "major",
        score,
        intervals: actualIntervals,
        exact,
        extras
      });
    }
  }

  matches.sort((a, b) => b.score - a.score || b.intervals.length - a.intervals.length);

  if (!matches.length) {
    return {
      primary: "",
      detail: "",
      matches: [],
      pitchClasses,
      root: pitchClasses[0] ?? null,
      quality: null
    };
  }

  const best = matches[0];
  const confidence = best.exact ? "Exact match" : best.extras.length ? "Best partial match" : "Likely match";

  return {
    primary: best.chordName,
    detail: confidence,
    matches: matches.slice(0, 6),
    pitchClasses,
    root: best.root,
    quality: best.quality
  };
}

export function pitchClassesEqual(left: number[], right: number[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}
