import { pitchClassName, uniquePitchClasses } from "@/lib/music/note-names";
import type { ObstaclePrompt, PromptAccent } from "@/types/game";

type RawPrompt = { root: number; quality: string; notes: number[]; accent?: PromptAccent };

// Each tier focuses on one shape category. Roots cover both natural and
// sharp/flat keys so the player sees the full keyboard.
//   Level 1: basic triads
//   Level 2: 7th chords
//   Level 3: sus + add9
//   Level 4: aug + dim
//   Level 5: 9ths
//   Level 6+: endurance — every shape mixed

const TRIADS: RawPrompt[] = [
  { root: 0, quality: "", notes: [60, 64, 67] },   // C
  { root: 5, quality: "", notes: [53, 57, 60] },   // F
  { root: 7, quality: "", notes: [55, 59, 62] },   // G
  { root: 2, quality: "", notes: [50, 54, 57] },   // D
  { root: 9, quality: "", notes: [57, 61, 64] },   // A
  { root: 4, quality: "", notes: [52, 56, 59] },   // E
  { root: 10, quality: "", notes: [58, 62, 65] },  // Bb / A#
  { root: 3, quality: "", notes: [63, 67, 70] },   // Eb / D#
  { root: 6, quality: "", notes: [54, 58, 61] },   // F#
  { root: 9, quality: "m", notes: [57, 60, 64] },  // Am
  { root: 2, quality: "m", notes: [50, 53, 57] },  // Dm
  { root: 4, quality: "m", notes: [52, 55, 59] },  // Em
  { root: 6, quality: "m", notes: [54, 57, 61] },  // F#m
  { root: 1, quality: "m", notes: [49, 52, 56] }   // C#m
];

const SEVENTHS: RawPrompt[] = [
  { root: 0, quality: "maj7", notes: [60, 64, 67, 71] },
  { root: 5, quality: "maj7", notes: [53, 57, 60, 64] },
  { root: 7, quality: "maj7", notes: [55, 59, 62, 66] },
  { root: 10, quality: "maj7", notes: [58, 62, 65, 69] }, // Bbmaj7
  { root: 3, quality: "maj7", notes: [63, 67, 70, 74] },  // Ebmaj7
  { root: 6, quality: "maj7", notes: [54, 58, 61, 65] },  // F#maj7
  { root: 7, quality: "7", notes: [55, 59, 62, 65] },
  { root: 2, quality: "7", notes: [50, 54, 57, 60] },
  { root: 9, quality: "7", notes: [57, 61, 64, 67] },
  { root: 10, quality: "7", notes: [58, 62, 65, 68] }, // Bb7
  { root: 4, quality: "7", notes: [52, 56, 59, 62] },
  { root: 9, quality: "m7", notes: [57, 60, 64, 67] },
  { root: 2, quality: "m7", notes: [50, 53, 57, 60] },
  { root: 6, quality: "m7", notes: [54, 57, 61, 64] }  // F#m7
];

const SUS_ADD9: RawPrompt[] = [
  { root: 2, quality: "sus4", notes: [50, 55, 57] },
  { root: 9, quality: "sus2", notes: [57, 59, 64] },
  { root: 0, quality: "sus2", notes: [60, 62, 67] },
  { root: 4, quality: "sus4", notes: [52, 57, 59] },
  { root: 7, quality: "sus4", notes: [55, 60, 62] },
  { root: 6, quality: "sus4", notes: [54, 59, 61] },   // F#sus4
  { root: 10, quality: "sus2", notes: [58, 60, 65] },  // Bbsus2
  { root: 3, quality: "sus4", notes: [63, 68, 70] },   // Ebsus4
  { root: 0, quality: "add9", notes: [60, 62, 64, 67] },
  { root: 2, quality: "add9", notes: [50, 52, 54, 57] },
  { root: 7, quality: "add9", notes: [55, 57, 59, 62] },
  { root: 4, quality: "add9", notes: [52, 54, 56, 59] },
  { root: 10, quality: "add9", notes: [58, 60, 62, 65] }, // Bbadd9
  { root: 6, quality: "add9", notes: [54, 56, 58, 61] }   // F#add9
];

const AUG_DIM: RawPrompt[] = [
  { root: 0, quality: "aug", notes: [60, 64, 68] },
  { root: 5, quality: "aug", notes: [53, 57, 61] },
  { root: 7, quality: "aug", notes: [55, 59, 63] },
  { root: 2, quality: "aug", notes: [50, 54, 58] },
  { root: 4, quality: "aug", notes: [52, 56, 60] },
  { root: 10, quality: "aug", notes: [58, 62, 66] }, // Bbaug
  { root: 6, quality: "aug", notes: [54, 58, 62] },  // F#aug
  { root: 11, quality: "dim", notes: [59, 62, 65] }, // Bdim
  { root: 4, quality: "dim", notes: [52, 55, 58] },
  { root: 6, quality: "dim", notes: [54, 57, 60] },  // F#dim
  { root: 1, quality: "dim", notes: [49, 52, 55] },  // C#dim
  { root: 8, quality: "dim", notes: [56, 59, 62] },  // G#dim
  { root: 10, quality: "dim", notes: [58, 61, 64] }, // Bbdim
  { root: 9, quality: "dim", notes: [57, 60, 63] }
];

const EXTENSIONS: RawPrompt[] = [
  { root: 0, quality: "9", notes: [60, 64, 67, 70, 74] },
  { root: 7, quality: "9", notes: [55, 59, 62, 65, 69] },
  { root: 2, quality: "9", notes: [50, 54, 57, 60, 64] },
  { root: 9, quality: "9", notes: [57, 61, 64, 67, 71] },
  { root: 10, quality: "9", notes: [58, 62, 65, 68, 72] }, // Bb9
  { root: 6, quality: "9", notes: [54, 58, 61, 64, 68] },  // F#9
  { root: 0, quality: "m9", notes: [60, 63, 67, 70, 74] },
  { root: 5, quality: "m9", notes: [53, 56, 60, 63, 67] },
  { root: 4, quality: "m9", notes: [52, 55, 59, 62, 66] },
  { root: 9, quality: "m9", notes: [57, 60, 64, 67, 71] },
  { root: 1, quality: "m9", notes: [49, 52, 56, 59, 63] } // C#m9
];

function poolForLevel(level: number): RawPrompt[] {
  switch (level) {
    case 1:
      return [...TRIADS];
    case 2:
      return [...SEVENTHS];
    case 3:
      return [...SUS_ADD9];
    case 4:
      return [...AUG_DIM];
    case 5:
      return [...EXTENSIONS];
    default:
      return [...TRIADS, ...SEVENTHS, ...SUS_ADD9, ...AUG_DIM, ...EXTENSIONS];
  }
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function hydrate(raw: RawPrompt, index: number): ObstaclePrompt {
  return {
    id: `${raw.root}-${raw.quality}-${index}`,
    root: raw.root,
    quality: raw.quality,
    accent: raw.accent ?? "lime",
    pitchClasses: uniquePitchClasses(raw.notes),
    notes: [...raw.notes]
  };
}

export function createPromptSequence(level = 1, size = 14): ObstaclePrompt[] {
  const pool = shuffle(poolForLevel(level));
  return Array.from({ length: size }, (_, i) => hydrate(pool[i % pool.length], i));
}

/**
 * Render a prompt's display label respecting the user's sharps/flats preference.
 */
export function promptLabel(prompt: ObstaclePrompt, preferFlats: boolean): string {
  return pitchClassName(prompt.root, preferFlats) + prompt.quality;
}
