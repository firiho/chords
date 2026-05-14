"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SplendidGrandPiano, Soundfont } from "smplr";

import {
  getVoiceSource,
  getVolume,
  hydrateFromStorage,
  setVolume,
  subscribeVoiceSource,
  subscribeVolume,
  type VoiceSource
} from "@/lib/audio/voice-source";
import { findPreset } from "@/components/sounds/presets";

type SynthVoice = {
  kind: "synth";
  gain: GainNode;
  oscs: OscillatorNode[];
};

type SmplrVoice = {
  kind: "smplr";
  presetId: string;
  stop: () => void;
};

type Voice = SynthVoice | SmplrVoice;

type SmplrInstrument = SplendidGrandPiano | Soundfont;

type CachedInstrument = {
  instrument: SmplrInstrument;
  loaded: boolean;
};

function midiToFrequency(note: number) {
  return 440 * 2 ** ((note - 69) / 12);
}

function createImpulse(context: AudioContext, seconds = 2.4, decay = 2.0) {
  const rate = context.sampleRate;
  const length = rate * seconds;
  const impulse = context.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch += 1) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
    }
  }
  return impulse;
}

export function useMidiSynth(activeNotes: number[]) {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [noteVolume, setNoteVolumeState] = useState<number>(() => getVolume());

  const audioContextRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const mixBusRef = useRef<GainNode | null>(null);
  const voiceBusRef = useRef<GainNode | null>(null);
  const reverbBusRef = useRef<GainNode | null>(null);
  const fxBusRef = useRef<GainNode | null>(null);
  const voicesRef = useRef(new Map<number, Voice>());
  const voiceSourceRef = useRef<VoiceSource>({ kind: "synth" });
  const smplrCacheRef = useRef(new Map<string, CachedInstrument>());

  const ensureAudio = useCallback(async () => {
    if (!audioContextRef.current) {
      const context = new AudioContext();
      const master = context.createGain();
      const mixBus = context.createGain();
      const voiceBus = context.createGain();
      const reverb = context.createConvolver();
      const reverbBus = context.createGain();
      const fxBus = context.createGain();

      master.gain.value = 0.6;
      mixBus.gain.value = getVolume();
      voiceBus.gain.value = 1.0;
      reverb.buffer = createImpulse(context);
      reverbBus.gain.value = 0.3;
      fxBus.gain.value = 0.55;

      voiceBus.connect(mixBus);
      mixBus.connect(master);
      mixBus.connect(reverbBus);
      reverbBus.connect(reverb);
      reverb.connect(master);
      fxBus.connect(master);
      master.connect(context.destination);

      audioContextRef.current = context;
      masterRef.current = master;
      mixBusRef.current = mixBus;
      voiceBusRef.current = voiceBus;
      reverbBusRef.current = reverbBus;
      fxBusRef.current = fxBus;
    }

    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
  }, []);

  // ---- Shared volume — drives mixBus and rebroadcasts to background pad ----
  useEffect(() => {
    const mixBus = mixBusRef.current;
    const context = audioContextRef.current;
    if (!mixBus || !context) return;
    const t = context.currentTime;
    mixBus.gain.cancelScheduledValues(t);
    mixBus.gain.setValueAtTime(mixBus.gain.value, t);
    mixBus.gain.linearRampToValueAtTime(noteVolume, t + 0.08);
  }, [noteVolume]);

  // Hydrate from store + subscribe to volume changes coming from elsewhere
  useEffect(() => {
    hydrateFromStorage();
    setNoteVolumeState(getVolume());
    const unsub = subscribeVolume((v) => setNoteVolumeState(v));
    return () => unsub();
  }, []);

  // Wrapper that updates the shared store (which then notifies everyone, including the pad)
  const setNoteVolume = useCallback((v: number) => {
    setVolume(v);
  }, []);

  // ---- smplr instrument cache ----
  function buildSmplrInstrument(presetId: string): CachedInstrument | null {
    const context = audioContextRef.current;
    const voiceBus = voiceBusRef.current;
    if (!context || !voiceBus) return null;
    const preset = findPreset(presetId);
    if (!preset) return null;

    let instrument: SmplrInstrument;
    if (preset.preset.type === "splendid-grand-piano") {
      instrument = new SplendidGrandPiano(context, { destination: voiceBus });
    } else {
      instrument = new Soundfont(context, {
        instrument: preset.preset.instrument,
        kit: preset.preset.kit ?? "FluidR3_GM",
        destination: voiceBus
      });
    }

    const cached: CachedInstrument = { instrument, loaded: false };
    instrument.load.then(() => {
      cached.loaded = true;
    });
    return cached;
  }

  function ensureSmplrInstrument(presetId: string): CachedInstrument | null {
    const cache = smplrCacheRef.current;
    if (cache.has(presetId)) return cache.get(presetId)!;
    const built = buildSmplrInstrument(presetId);
    if (!built) return null;
    cache.set(presetId, built);
    return built;
  }

  // ---- Played-note voice dispatch ----
  function startVoice(note: number) {
    const vs = voiceSourceRef.current;
    if (vs.kind === "smplr") {
      const cached = ensureSmplrInstrument(vs.id);
      if (cached && cached.loaded) {
        try {
          const stopFn = cached.instrument.start({ note, velocity: 96 });
          voicesRef.current.set(note, {
            kind: "smplr",
            presetId: vs.id,
            stop: () => {
              try {
                if (typeof stopFn === "function") (stopFn as (t?: number) => void)();
                else cached.instrument.stop(note);
              } catch {
                /* ignore */
              }
            }
          });
          return;
        } catch {
          /* fall through to synth */
        }
      }
    }
    startSynthVoice(note);
  }

  function startSynthVoice(note: number) {
    const context = audioContextRef.current;
    const voiceBus = voiceBusRef.current;
    if (!context || !voiceBus || voicesRef.current.has(note)) return;

    const freq = midiToFrequency(note);
    const now = context.currentTime;

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    const peakCutoff = Math.min(freq * 14 + 1200, 7000);
    const sustainCutoff = Math.min(freq * 6 + 600, 4400);
    filter.frequency.setValueAtTime(peakCutoff, now);
    filter.frequency.exponentialRampToValueAtTime(sustainCutoff, now + 0.18);
    filter.Q.value = 0.9;

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.26, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.12);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.6);

    const detuneCents = [-7, 0, 7];
    const oscs: OscillatorNode[] = detuneCents.map((cents) => {
      const osc = context.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      osc.detune.value = cents;
      osc.connect(filter);
      osc.start();
      return osc;
    });

    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    lfo.frequency.value = 5.2 + Math.random() * 0.4;
    lfoGain.gain.setValueAtTime(0.0001, now);
    lfoGain.gain.exponentialRampToValueAtTime(3, now + 0.35);
    lfo.connect(lfoGain);
    oscs.forEach((o) => lfoGain.connect(o.detune));
    lfo.start();

    filter.connect(gain);
    gain.connect(voiceBus);

    voicesRef.current.set(note, { kind: "synth", gain, oscs: [...oscs, lfo] });
  }

  function stopVoice(note: number, voice = voicesRef.current.get(note)) {
    const context = audioContextRef.current;
    if (!context || !voice) return;
    if (voice.kind === "smplr") {
      voice.stop();
      voicesRef.current.delete(note);
      return;
    }
    const t = context.currentTime;
    voice.gain.gain.cancelScheduledValues(t);
    voice.gain.gain.setValueAtTime(Math.max(voice.gain.gain.value, 0.0001), t);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    voice.oscs.forEach((o) => o.stop(t + 0.16));
    voicesRef.current.delete(note);
  }

  const playSfx = useCallback((kind: "jump" | "score" | "fail") => {
    const context = audioContextRef.current;
    const fxBus = fxBusRef.current;
    if (!context || !fxBus) return;
    const t = context.currentTime;

    if (kind === "jump") {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(420, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.12);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(gain);
      gain.connect(fxBus);
      osc.start(t);
      osc.stop(t + 0.2);
    } else if (kind === "score") {
      [0, 4, 7].forEach((semi, i) => {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = "triangle";
        osc.frequency.value = midiToFrequency(72 + semi);
        const start = t + i * 0.04;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.14, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
        osc.connect(gain);
        gain.connect(fxBus);
        osc.start(start);
        osc.stop(start + 0.3);
      });
    } else {
      const osc = context.createOscillator();
      const gain = context.createGain();
      const noise = context.createOscillator();
      const noiseGain = context.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(55, t + 0.7);
      noise.type = "square";
      noise.frequency.setValueAtTime(80, t);
      noise.frequency.linearRampToValueAtTime(40, t + 0.7);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
      noiseGain.gain.setValueAtTime(0.0001, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      osc.connect(gain);
      noise.connect(noiseGain);
      gain.connect(fxBus);
      noiseGain.connect(fxBus);
      osc.start(t);
      noise.start(t);
      osc.stop(t + 0.8);
      noise.stop(t + 0.7);
    }
  }, []);

  const toggleAudio = useCallback(async () => {
    if (audioEnabled) {
      voicesRef.current.forEach((voice, note) => stopVoice(note, voice));
      voicesRef.current.clear();
      setAudioEnabled(false);
      return;
    }
    await ensureAudio();
    setAudioEnabled(true);
  }, [audioEnabled, ensureAudio]);

  // Sync voice-source selection from the global store
  useEffect(() => {
    hydrateFromStorage();
    voiceSourceRef.current = getVoiceSource();

    if (voiceSourceRef.current.kind === "smplr") {
      ensureSmplrInstrument(voiceSourceRef.current.id);
    }

    const unsub = subscribeVoiceSource((vs) => {
      voiceSourceRef.current = vs;
      if (vs.kind === "smplr" && audioContextRef.current) {
        ensureSmplrInstrument(vs.id);
      }
    });
    return () => unsub();
  }, []);

  // First user gesture initializes audio if enabled
  useEffect(() => {
    if (!audioEnabled) return;
    let initialized = false;
    const init = async () => {
      if (initialized) return;
      initialized = true;
      await ensureAudio();
      if (voiceSourceRef.current.kind === "smplr") {
        ensureSmplrInstrument(voiceSourceRef.current.id);
      }
      window.removeEventListener("pointerdown", init);
      window.removeEventListener("keydown", init);
    };
    window.addEventListener("pointerdown", init);
    window.addEventListener("keydown", init);
    return () => {
      window.removeEventListener("pointerdown", init);
      window.removeEventListener("keydown", init);
    };
  }, [audioEnabled, ensureAudio]);

  // Reconciliation
  useEffect(() => {
    if (!audioEnabled) return;
    if (!audioContextRef.current) return;
    const activeSet = new Set(activeNotes);
    [...voicesRef.current.keys()].forEach((note) => {
      if (!activeSet.has(note)) stopVoice(note);
    });
    activeNotes.forEach((note) => {
      if (!voicesRef.current.has(note)) startVoice(note);
    });
  }, [activeNotes, audioEnabled]);

  useEffect(() => {
    return () => {
      voicesRef.current.forEach((voice, note) => stopVoice(note, voice));
      voicesRef.current.clear();
      smplrCacheRef.current.forEach(({ instrument }) => {
        try { instrument.disconnect(); } catch { /* ignore */ }
      });
      smplrCacheRef.current.clear();
      const ctx = audioContextRef.current;
      if (ctx && ctx.state !== "closed") {
        try { ctx.close(); } catch { /* already closed */ }
      }
      audioContextRef.current = null;
    };
  }, []);

  const triggerNote = useCallback((note: number, on: boolean) => {
    if (!audioEnabled) return;
    if (!audioContextRef.current) return;
    if (on) startVoice(note);
    else stopVoice(note);
  }, [audioEnabled]);

  return {
    audioEnabled,
    toggleAudio,
    playSfx,
    noteVolume,
    setNoteVolume,
    triggerNote
  };
}
