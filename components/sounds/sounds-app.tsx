"use client";

import { useEffect, useRef, useState } from "react";
import { SplendidGrandPiano, Soundfont } from "smplr";

import { TopBar } from "@/components/layout/top-bar";
import { findPreset, VOICE_PRESETS, type SoundPreset } from "@/components/sounds/presets";
import { useMidiInput } from "@/hooks/use-midi-input";
import { useMidiSynth } from "@/hooks/use-midi-synth";
import {
  getAccompanimentEnabled,
  getVoiceSource,
  hydrateFromStorage,
  setAccompanimentEnabled,
  setVoiceSource,
  subscribeAccompaniment,
  subscribeVoiceSource,
  type VoiceSource
} from "@/lib/audio/voice-source";

type PresetIcon = "synth" | "piano" | "rhodes" | "strings" | "harp" | "organ" | "pad" | "vibes" | "bell";

const ICON_FOR_ID: Record<string, PresetIcon> = {
  "splendid-grand": "piano",
  "electric-piano": "rhodes",
  "string-ensemble": "strings",
  "orchestral-harp": "harp",
  "church-organ": "organ",
  "synth-strings": "pad",
  vibraphone: "vibes",
  celesta: "bell"
};

const PREVIEW_NOTES = [60, 64, 67]; // C major triad — C, E, G
const PREVIEW_STAGGER_MS = 280;
const PREVIEW_HOLD_MS = 900;

function PresetGlyph({ kind }: { kind: PresetIcon }) {
  switch (kind) {
    case "piano":
      return (
        <svg viewBox="0 0 32 32" className="preset-glyph">
          <rect x="3" y="6" width="26" height="20" rx="2" fill="currentColor" opacity="0.18" />
          <rect x="3" y="6" width="26" height="20" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="9" y1="6" x2="9" y2="26" stroke="currentColor" strokeWidth="1" opacity="0.5" />
          <line x1="15" y1="6" x2="15" y2="26" stroke="currentColor" strokeWidth="1" opacity="0.5" />
          <line x1="21" y1="6" x2="21" y2="26" stroke="currentColor" strokeWidth="1" opacity="0.5" />
          <rect x="6" y="6" width="3" height="11" rx="0.5" fill="currentColor" />
          <rect x="13" y="6" width="3" height="11" rx="0.5" fill="currentColor" />
          <rect x="19" y="6" width="3" height="11" rx="0.5" fill="currentColor" />
        </svg>
      );
    case "rhodes":
      return (
        <svg viewBox="0 0 32 32" className="preset-glyph">
          <rect x="4" y="10" width="24" height="14" rx="2" fill="currentColor" opacity="0.2" />
          <rect x="4" y="10" width="24" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="9" cy="17" r="1.5" fill="currentColor" />
          <circle cx="16" cy="17" r="1.5" fill="currentColor" />
          <circle cx="23" cy="17" r="1.5" fill="currentColor" />
        </svg>
      );
    case "strings":
    case "pad":
      return (
        <svg viewBox="0 0 32 32" className="preset-glyph">
          <path d="M4 20 Q 10 8 16 20 T 28 20" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4 14 Q 10 2 16 14 T 28 14" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        </svg>
      );
    case "harp":
      return (
        <svg viewBox="0 0 32 32" className="preset-glyph">
          <path d="M6 6 L 6 26 L 26 6 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10" y1="9" x2="10" y2="26" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
          <line x1="14" y1="12" x2="14" y2="26" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
          <line x1="18" y1="15" x2="18" y2="26" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
          <line x1="22" y1="18" x2="22" y2="26" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
        </svg>
      );
    case "organ":
      return (
        <svg viewBox="0 0 32 32" className="preset-glyph">
          <rect x="5" y="6" width="3" height="20" rx="0.5" fill="currentColor" />
          <rect x="10" y="9" width="3" height="17" rx="0.5" fill="currentColor" opacity="0.85" />
          <rect x="15" y="4" width="3" height="22" rx="0.5" fill="currentColor" />
          <rect x="20" y="9" width="3" height="17" rx="0.5" fill="currentColor" opacity="0.85" />
          <rect x="25" y="6" width="3" height="20" rx="0.5" fill="currentColor" />
        </svg>
      );
    case "vibes":
      return (
        <svg viewBox="0 0 32 32" className="preset-glyph">
          <rect x="5" y="11" width="4" height="14" rx="1" fill="currentColor" />
          <rect x="12" y="9" width="4" height="16" rx="1" fill="currentColor" />
          <rect x="19" y="11" width="4" height="14" rx="1" fill="currentColor" />
          <rect x="26" y="13" width="3" height="12" rx="1" fill="currentColor" opacity="0.7" />
        </svg>
      );
    case "bell":
      return (
        <svg viewBox="0 0 32 32" className="preset-glyph">
          <path d="M16 5 C 9 5 8 14 8 20 L 24 20 C 24 14 23 5 16 5 Z" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="16" cy="24" r="2" fill="currentColor" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 32 32" className="preset-glyph">
          <rect x="4" y="14" width="24" height="6" rx="3" fill="currentColor" opacity="0.2" />
          <rect x="4" y="14" width="24" height="6" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="10" cy="17" r="1.4" fill="currentColor" />
          <circle cx="16" cy="17" r="1.4" fill="currentColor" />
          <circle cx="22" cy="17" r="1.4" fill="currentColor" />
        </svg>
      );
  }
}

function midiToFreq(note: number) {
  return 440 * 2 ** ((note - 69) / 12);
}

// =====================================================================
// Module-level cache for preview AudioContext + smplr instruments.
// Survives client-side navigation so revisiting /sounds doesn't re-download
// every sample pack. Only a hard refresh starts from scratch.
// =====================================================================

type SoundsCache = {
  ctx: AudioContext | null;
  instruments: Map<string, SplendidGrandPiano | Soundfont>;
  loadedIds: Set<string>;
};

const SOUNDS_CACHE_KEY = "__chordsSoundsCache";

function getSoundsCache(): SoundsCache {
  const g = globalThis as unknown as Record<string, SoundsCache | undefined>;
  if (!g[SOUNDS_CACHE_KEY]) {
    g[SOUNDS_CACHE_KEY] = {
      ctx: null,
      instruments: new Map(),
      loadedIds: new Set()
    };
  }
  return g[SOUNDS_CACHE_KEY]!;
}

export function SoundsApp() {
  const [voice, setVoice] = useState<VoiceSource>(() => getVoiceSource());
  const [accomp, setAccomp] = useState<boolean>(() => getAccompanimentEnabled());
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  // Seed from the persistent cache so revisits show already-loaded badges instantly
  const [loadedIds, setLoadedIds] = useState<Set<string>>(() => new Set(getSoundsCache().loadedIds));

  // MIDI input + synth so /sounds receives notes and the shared header controls work
  const triggerNoteRef = useRef<(note: number, on: boolean) => void>(() => {});
  const { activeNotes, chord, connectMidi, inputs, midiSupported, preferFlats, setPreferFlats } = useMidiInput({
    onNoteEvent: (note, on) => triggerNoteRef.current(note, on)
  });
  const { audioEnabled, toggleAudio, noteVolume, setNoteVolume, triggerNote } = useMidiSynth(activeNotes);
  triggerNoteRef.current = triggerNote;
  const midiReady = inputs.length > 0;

  const previewStopsRef = useRef<Array<() => void>>([]);
  const previewTimeoutRef = useRef<number | null>(null);
  const previewGenRef = useRef(0);

  useEffect(() => {
    hydrateFromStorage();
    setVoice(getVoiceSource());
    setAccomp(getAccompanimentEnabled());
    const u1 = subscribeVoiceSource(setVoice);
    const u2 = subscribeAccompaniment(setAccomp);
    return () => {
      u1();
      u2();
    };
  }, []);

  // Pre-warm every preset using the global cache so it only happens once per tab
  useEffect(() => {
    let cancelled = false;
    const cache = getSoundsCache();
    if (!cache.ctx) {
      try {
        cache.ctx = new AudioContext();
      } catch {
        return;
      }
    }
    const ctx = cache.ctx;

    VOICE_PRESETS.forEach((preset) => {
      if (cancelled) return;
      let inst = cache.instruments.get(preset.id);
      if (!inst) {
        try {
          inst = buildInstrument(ctx, preset);
        } catch {
          return;
        }
        cache.instruments.set(preset.id, inst);
      }
      // Always attach a listener. Promises can have multiple .then handlers,
      // and if the load already resolved this fires immediately.
      inst.load
        .then(() => {
          cache.loadedIds.add(preset.id);
          if (cancelled) return;
          setLoadedIds((prev) => {
            if (prev.has(preset.id)) return prev;
            const next = new Set(prev);
            next.add(preset.id);
            return next;
          });
        })
        .catch(() => {
          /* network/decode failed — leave it unmarked, click will retry */
        });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Stop any in-flight preview when this component unmounts, but DO NOT
  // disconnect the instruments or close the context — they're shared.
  useEffect(() => {
    return () => {
      previewStopsRef.current.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
      previewStopsRef.current = [];
      if (previewTimeoutRef.current !== null) {
        window.clearTimeout(previewTimeoutRef.current);
        previewTimeoutRef.current = null;
      }
    };
  }, []);

  async function ensureCtx(): Promise<AudioContext> {
    const cache = getSoundsCache();
    if (!cache.ctx) cache.ctx = new AudioContext();
    if (cache.ctx.state === "suspended") await cache.ctx.resume();
    return cache.ctx;
  }

  function buildInstrument(ctx: AudioContext, preset: SoundPreset): SplendidGrandPiano | Soundfont {
    if (preset.preset.type === "splendid-grand-piano") {
      return new SplendidGrandPiano(ctx);
    }
    return new Soundfont(ctx, {
      instrument: preset.preset.instrument,
      kit: preset.preset.kit ?? "FluidR3_GM"
    });
  }

  function cancelCurrentPreview() {
    previewStopsRef.current.forEach((fn) => {
      try { fn(); } catch { /* ignore */ }
    });
    previewStopsRef.current = [];
    if (previewTimeoutRef.current !== null) {
      window.clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
    // Also call instrument-wide stop on every cached smplr instance to be safe
    getSoundsCache().instruments.forEach((inst) => {
      try { inst.stop(); } catch { /* ignore */ }
    });
  }

  function playSynthArpeggio(ctx: AudioContext): Array<() => void> {
    const start = ctx.currentTime + 0.05;
    const stops: Array<() => void> = [];
    PREVIEW_NOTES.forEach((note, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = midiToFreq(note);
      const t = start + (i * PREVIEW_STAGGER_MS) / 1000;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + (PREVIEW_HOLD_MS / 1000));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + PREVIEW_HOLD_MS / 1000 + 0.05);

      stops.push(() => {
        try {
          const now = ctx.currentTime;
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
          osc.stop(now + 0.05);
        } catch { /* already stopped */ }
      });
    });
    return stops;
  }

  async function previewPreset(presetId: string) {
    // Stop whatever's playing right now and bump the generation so any
    // in-flight previews know they've been superseded.
    cancelCurrentPreview();
    const myGen = ++previewGenRef.current;
    setPreviewingId(presetId);

    const ctx = await ensureCtx();
    if (previewGenRef.current !== myGen) return;

    if (presetId === "synth") {
      previewStopsRef.current = playSynthArpeggio(ctx);
      previewTimeoutRef.current = window.setTimeout(() => {
        if (previewGenRef.current === myGen) setPreviewingId(null);
      }, PREVIEW_STAGGER_MS * PREVIEW_NOTES.length + 400);
      return;
    }

    const preset = findPreset(presetId);
    if (!preset) {
      setPreviewingId(null);
      return;
    }

    const cache = getSoundsCache();
    let inst = cache.instruments.get(presetId);
    if (!inst) {
      inst = buildInstrument(ctx, preset);
      cache.instruments.set(presetId, inst);
    }
    const playingInst = inst;

    try {
      await inst.load;
      if (previewGenRef.current !== myGen) return;

      const start = ctx.currentTime + 0.05;
      const stops: Array<() => void> = [];
      PREVIEW_NOTES.forEach((note, i) => {
        const t = start + (i * PREVIEW_STAGGER_MS) / 1000;
        const stopFn = playingInst.start({
          note,
          time: t,
          velocity: 96,
          duration: PREVIEW_HOLD_MS / 1000
        });
        if (typeof stopFn === "function") {
          stops.push(() => { try { (stopFn as (t?: number) => void)(); } catch { /* ignore */ } });
        }
      });
      // Last-resort stop: cut all sound on this instrument
      stops.push(() => { try { playingInst.stop(); } catch { /* ignore */ } });
      previewStopsRef.current = stops;
    } catch {
      /* ignore */
    } finally {
      previewTimeoutRef.current = window.setTimeout(() => {
        if (previewGenRef.current === myGen) setPreviewingId(null);
      }, PREVIEW_STAGGER_MS * PREVIEW_NOTES.length + 600);
    }
  }

  function pickPreset(id: string, label: string) {
    setVoiceSource({ kind: "smplr", id, label });
    previewPreset(id);
  }

  function useSynth() {
    setVoiceSource({ kind: "synth" });
    previewPreset("synth");
  }

  const activeId = voice.kind === "synth" ? "synth" : voice.id;

  return (
    <main className="sounds-shell">
      <div className="page-noise" />
      <div className="page-glow page-glow-a" />
      <div className="page-glow page-glow-b" />

      <TopBar
        midiReady={midiReady}
        midiSupported={midiSupported}
        connectMidi={connectMidi}
        audioEnabled={audioEnabled}
        toggleAudio={toggleAudio}
        noteVolume={noteVolume}
        setNoteVolume={setNoteVolume}
        preferFlats={preferFlats}
        setPreferFlats={setPreferFlats}
        chord={chord}
      />

      <section className="sounds-body">
        <header className="voices-head">
          <h2>Voices</h2>
          <button
            type="button"
            className={`accomp-pill ${accomp ? "accomp-pill-on" : ""}`}
            onClick={() => setAccompanimentEnabled(!accomp)}
            role="switch"
            aria-checked={accomp}
          >
            <span className="accomp-pill-dot" aria-hidden />
            <span className="accomp-pill-label">Background strings</span>
          </button>
        </header>

        <div className="presets-grid">
          <button
            type="button"
            className={`preset-card ${activeId === "synth" ? "preset-card-active" : ""} ${previewingId === "synth" ? "preset-card-previewing" : ""}`}
            onClick={useSynth}
          >
            <div className="preset-icon">
              <PresetGlyph kind="synth" />
            </div>
            <div className="preset-meta">
              <strong className="preset-name">Built-in Synth</strong>
              <span className="preset-desc">Detuned saw ensemble</span>
            </div>
          </button>

          {VOICE_PRESETS.map((preset) => {
            const isActive = activeId === preset.id;
            const isPreviewing = previewingId === preset.id;
            const isLoaded = loadedIds.has(preset.id);
            return (
              <button
                key={preset.id}
                type="button"
                className={`preset-card ${isActive ? "preset-card-active" : ""} ${isPreviewing ? "preset-card-previewing" : ""} ${isLoaded ? "" : "preset-card-loading"}`}
                onClick={() => pickPreset(preset.id, preset.label)}
              >
                <div className="preset-icon">
                  <PresetGlyph kind={ICON_FOR_ID[preset.id] ?? "synth"} />
                </div>
                <div className="preset-meta">
                  <strong className="preset-name">
                    {preset.label}
                    {!isLoaded && <span className="preset-loading-dot" aria-label="Loading sample" />}
                  </strong>
                  <span className="preset-desc">{preset.description}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
