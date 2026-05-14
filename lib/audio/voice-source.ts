// Shared store for: which voice the synth uses + whether the accompaniment pad plays.

export type VoiceSource =
  | { kind: "synth" }
  | { kind: "smplr"; id: string; label: string };

const VOICE_LS_KEY = "chords:voice-source";
const ACCOMP_LS_KEY = "chords:accompaniment-on";
const VOLUME_LS_KEY = "chords:volume";

let currentVoice: VoiceSource = { kind: "synth" };
let currentAccomp = true;
let currentVolume = 0.7;

const voiceListeners = new Set<(v: VoiceSource) => void>();
const accompListeners = new Set<(v: boolean) => void>();
const volumeListeners = new Set<(v: number) => void>();

export function getVoiceSource(): VoiceSource {
  return currentVoice;
}

export function setVoiceSource(next: VoiceSource) {
  currentVoice = next;
  try {
    if (next.kind === "synth") {
      localStorage.removeItem(VOICE_LS_KEY);
    } else {
      localStorage.setItem(VOICE_LS_KEY, JSON.stringify(next));
    }
  } catch {
    /* ignore */
  }
  voiceListeners.forEach((l) => l(next));
}

export function subscribeVoiceSource(listener: (v: VoiceSource) => void): () => void {
  voiceListeners.add(listener);
  return () => voiceListeners.delete(listener);
}

export function getAccompanimentEnabled(): boolean {
  return currentAccomp;
}

export function setAccompanimentEnabled(v: boolean) {
  currentAccomp = v;
  try {
    localStorage.setItem(ACCOMP_LS_KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
  accompListeners.forEach((l) => l(v));
}

export function subscribeAccompaniment(listener: (v: boolean) => void): () => void {
  accompListeners.add(listener);
  return () => accompListeners.delete(listener);
}

export function getVolume(): number {
  return currentVolume;
}

export function setVolume(v: number) {
  currentVolume = v;
  try {
    localStorage.setItem(VOLUME_LS_KEY, v.toString());
  } catch {
    /* ignore */
  }
  volumeListeners.forEach((l) => l(v));
}

export function subscribeVolume(listener: (v: number) => void): () => void {
  volumeListeners.add(listener);
  return () => volumeListeners.delete(listener);
}

export function hydrateFromStorage() {
  if (typeof window === "undefined") return;
  try {
    const rawVoice = localStorage.getItem(VOICE_LS_KEY);
    if (rawVoice) {
      const parsed = JSON.parse(rawVoice) as VoiceSource;
      if (parsed.kind === "smplr" && parsed.id && parsed.label) {
        currentVoice = parsed;
        voiceListeners.forEach((l) => l(parsed));
      }
    }
    const rawAccomp = localStorage.getItem(ACCOMP_LS_KEY);
    if (rawAccomp !== null) {
      currentAccomp = rawAccomp === "1";
      accompListeners.forEach((l) => l(currentAccomp));
    }
    const rawVolume = localStorage.getItem(VOLUME_LS_KEY);
    if (rawVolume !== null) {
      const v = parseFloat(rawVolume);
      if (!Number.isNaN(v)) {
        currentVolume = Math.min(1, Math.max(0, v));
        volumeListeners.forEach((l) => l(currentVolume));
      }
    }
  } catch {
    /* malformed entry */
  }
}
