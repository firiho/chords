// Each preset references a smplr-backed instrument. The synth lazy-loads the
// samples on first use and caches them.

export type SmplrPresetKind =
  | { type: "splendid-grand-piano" }
  | { type: "soundfont"; instrument: string; kit?: string };

export type SoundPreset = {
  id: string;
  label: string;
  description: string;
  preset: SmplrPresetKind;
};

export const VOICE_PRESETS: SoundPreset[] = [
  {
    id: "splendid-grand",
    label: "Splendid Grand Piano",
    description: "Salamander Steinway samples · pristine acoustic grand",
    preset: { type: "splendid-grand-piano" }
  },
  {
    id: "electric-piano",
    label: "Electric Piano",
    description: "Rhodes-style mellow electric",
    preset: { type: "soundfont", instrument: "electric_piano_1" }
  },
  {
    id: "string-ensemble",
    label: "String Ensemble",
    description: "Bowed strings · classic film pad",
    preset: { type: "soundfont", instrument: "string_ensemble_1" }
  },
  {
    id: "orchestral-harp",
    label: "Orchestral Harp",
    description: "Plucked harp · airy and bright",
    preset: { type: "soundfont", instrument: "orchestral_harp" }
  },
  {
    id: "church-organ",
    label: "Pipe Organ",
    description: "Cathedral pipes with deep low end",
    preset: { type: "soundfont", instrument: "church_organ" }
  },
  {
    id: "synth-strings",
    label: "Synth Strings",
    description: "Lush analog-style string pad",
    preset: { type: "soundfont", instrument: "synth_strings_1" }
  },
  {
    id: "vibraphone",
    label: "Vibraphone",
    description: "Soft mallet bars · jazz club vibe",
    preset: { type: "soundfont", instrument: "vibraphone" }
  },
  {
    id: "celesta",
    label: "Celesta",
    description: "Glittering bell tones",
    preset: { type: "soundfont", instrument: "celesta" }
  }
];

export function findPreset(id: string): SoundPreset | undefined {
  return VOICE_PRESETS.find((p) => p.id === id);
}
