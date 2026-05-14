// Persistent string-pad service. Lives at module scope so it keeps running
// across client-side route changes (e.g. /sounds <-> /). Only turns off when:
//   - The user toggles "Background strings" off
//   - The whole tab is closed / hard-refreshed
//
// First user gesture initializes the AudioContext (browsers require this).

const PAD_BASE_MIDI = 60; // C4 — sits in the mids

type Bundle = {
  ctx: AudioContext;
  master: GainNode;
  volume: GainNode; // controlled by the global volume slider
  bus: GainNode;
  lowpass: BiquadFilterNode;
  shelf: BiquadFilterNode;
  body: BiquadFilterNode; // gentle warmth peak around 280 Hz
  lfo: OscillatorNode;
  lfoGain: GainNode;
  filterLfo: OscillatorNode;
  filterLfoGain: GainNode;
  voices: { oscs: OscillatorNode[]; gain: GainNode; semi: number }[];
};

type State = {
  bundle: Bundle | null;
  accomp: boolean;
  volume: number;
  root: number | null;
  quality: string | null;
};

const STORE_KEY = "__chordsPadState";

function getState(): State {
  const g = globalThis as unknown as Record<string, State | undefined>;
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = {
      bundle: null,
      accomp: true,
      volume: 0.7,
      root: 0,
      quality: null
    };
  }
  return g[STORE_KEY]!;
}

function midiToFreq(note: number) {
  return 440 * 2 ** ((note - 69) / 12);
}

function intervalsForQuality(quality: string | null): [number, number, number] {
  const q = (quality ?? "").toLowerCase();
  const isDim = q.startsWith("dim");
  const isAug = q.startsWith("aug");
  const isMinor = q.startsWith("m") && !q.startsWith("maj");
  if (isDim) return [0, 3, 6];
  if (isAug) return [0, 4, 8];
  if (isMinor) return [0, 3, 7];
  return [0, 4, 7];
}

function buildBundle(): Bundle | null {
  let ctx: AudioContext;
  try {
    ctx = new AudioContext();
  } catch {
    return null;
  }

  const master = ctx.createGain();
  const volume = ctx.createGain();
  const bus = ctx.createGain();

  // Two-stage rolloff: lowpass + high-shelf knocks the brittle highs off
  // and a small body peak around 280 Hz adds warmth without muddiness.
  const lowpass = ctx.createBiquadFilter();
  const shelf = ctx.createBiquadFilter();
  const body = ctx.createBiquadFilter();

  master.gain.value = 0.6;
  volume.gain.value = getState().volume;
  bus.gain.value = 0.0001;
  lowpass.type = "lowpass";
  lowpass.frequency.value = 880;
  lowpass.Q.value = 0.4;
  shelf.type = "highshelf";
  shelf.frequency.value = 1600;
  shelf.gain.value = -14;
  body.type = "peaking";
  body.frequency.value = 280;
  body.Q.value = 0.9;
  body.gain.value = 2.4;

  // Chain: voices → body → lowpass → shelf → bus → volume → master → destination
  body.connect(lowpass);
  lowpass.connect(shelf);
  shelf.connect(bus);
  bus.connect(volume);
  volume.connect(master);
  master.connect(ctx.destination);

  // 3 oscillators per voice for a fuller ensemble. Root carries most of the
  // weight; third and fifth sit a touch softer so the chord stays balanced.
  const initialIntervals = [0, 4, 7];
  const voiceGains = [0.5, 0.32, 0.28];
  const detuneTriplets: number[][] = [
    [-8, 0, 8], // root
    [-10, 0, 10], // third
    [-6, 0, 6] // fifth
  ];

  const voices = initialIntervals.map((semi, idx) => {
    const gain = ctx.createGain();
    gain.gain.value = voiceGains[idx];
    const baseFreq = midiToFreq(PAD_BASE_MIDI + semi);
    const oscs = detuneTriplets[idx].map((cents) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = baseFreq;
      osc.detune.value = cents;
      osc.connect(gain);
      osc.start();
      return osc;
    });
    gain.connect(body);
    return { oscs, gain, semi };
  });

  // Slow ensemble drift (pitch shimmer)
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.22;
  lfoGain.gain.value = 2.2;
  lfo.connect(lfoGain);
  voices.forEach((v) => v.oscs.forEach((osc) => lfoGain.connect(osc.detune)));
  lfo.start();

  // Slow filter sweep — the pad "breathes" a little as the cutoff drifts
  const filterLfo = ctx.createOscillator();
  const filterLfoGain = ctx.createGain();
  filterLfo.frequency.value = 0.12;
  filterLfoGain.gain.value = 90; // ±90 Hz around 880 Hz cutoff
  filterLfo.connect(filterLfoGain);
  filterLfoGain.connect(lowpass.frequency);
  filterLfo.start();

  return { ctx, master, volume, bus, lowpass, shelf, body, lfo, lfoGain, filterLfo, filterLfoGain, voices };
}

function fadeBusTo(bundle: Bundle, target: number, seconds: number) {
  const t = bundle.ctx.currentTime;
  bundle.bus.gain.cancelScheduledValues(t);
  bundle.bus.gain.setValueAtTime(Math.max(bundle.bus.gain.value, 0.0001), t);
  bundle.bus.gain.exponentialRampToValueAtTime(Math.max(target, 0.0001), t + seconds);
}

function applyChord(bundle: Bundle, root: number, quality: string | null) {
  const t = bundle.ctx.currentTime;
  const intervals = intervalsForQuality(quality);
  bundle.voices.forEach((voice, i) => {
    const semi = intervals[i] ?? 0;
    const midi = PAD_BASE_MIDI + ((((root + semi) % 12) + 12) % 12);
    const target = midiToFreq(midi);
    voice.oscs.forEach((osc) => {
      osc.frequency.cancelScheduledValues(t);
      osc.frequency.setValueAtTime(osc.frequency.value, t);
      osc.frequency.linearRampToValueAtTime(target, t + 1.0);
    });
  });
}

function applyVolume(bundle: Bundle, v: number) {
  const t = bundle.ctx.currentTime;
  bundle.volume.gain.cancelScheduledValues(t);
  bundle.volume.gain.setValueAtTime(bundle.volume.gain.value, t);
  bundle.volume.gain.linearRampToValueAtTime(v, t + 0.08);
}

export async function ensurePadInitialized(): Promise<void> {
  const state = getState();
  if (!state.bundle) {
    const bundle = buildBundle();
    if (!bundle) return;
    state.bundle = bundle;
  }
  if (state.bundle.ctx.state === "suspended") {
    try { await state.bundle.ctx.resume(); } catch { /* ignore */ }
  }
  if (state.accomp) {
    fadeBusTo(state.bundle, 0.08, 2.6);
    if (state.root !== null) applyChord(state.bundle, state.root, state.quality);
  }
  applyVolume(state.bundle, state.volume);
}

export function setPadAccompaniment(on: boolean) {
  const state = getState();
  state.accomp = on;
  if (!state.bundle) return;
  if (on) {
    fadeBusTo(state.bundle, 0.08, 2.0);
    if (state.root !== null) applyChord(state.bundle, state.root, state.quality);
  } else {
    fadeBusTo(state.bundle, 0.0001, 0.8);
  }
}

export function setPadChord(root: number | null, quality: string | null) {
  const state = getState();
  if (root !== null) {
    state.root = root;
    state.quality = quality;
  }
  if (!state.bundle || !state.accomp || root === null) return;
  applyChord(state.bundle, root, quality);
}

export function setPadVolume(v: number) {
  const state = getState();
  state.volume = v;
  if (!state.bundle) return;
  applyVolume(state.bundle, v);
}
