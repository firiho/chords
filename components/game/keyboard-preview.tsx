"use client";

import { useEffect, useRef, useState } from "react";
import { normalizePitchClass } from "@/lib/music/note-names";

const BLACK_PCS = new Set([1, 3, 6, 8, 10]);
// Extended range — C-1 (0) to C9 (120). Bottom key lands on C.
const START_MIDI = 0;
const END_MIDI = 120;
const WHITE_KEY_WIDTH = 38;
const BLACK_KEY_WIDTH = 24;
const KEY_HEIGHT = 130;
const BLACK_HEIGHT_PCT = 64;

type KeyboardPreviewProps = {
  activeNotes: number[];
  hintNotes?: number[];
  hintKey?: number;
};

type WhiteKey = { midi: number; index: number; left: number };
type BlackKey = { midi: number; left: number };

function buildKeyLayout(): { whites: WhiteKey[]; blacks: BlackKey[]; totalWidth: number } {
  const whites: WhiteKey[] = [];
  const blacks: BlackKey[] = [];
  for (let midi = START_MIDI; midi <= END_MIDI; midi += 1) {
    const pc = normalizePitchClass(midi);
    if (BLACK_PCS.has(pc)) {
      const whiteBefore = whites.length - 1;
      const left = (whiteBefore + 1) * WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2;
      blacks.push({ midi, left });
    } else {
      const index = whites.length;
      whites.push({ midi, index, left: index * WHITE_KEY_WIDTH });
    }
  }
  return { whites, blacks, totalWidth: whites.length * WHITE_KEY_WIDTH };
}

const LAYOUT = buildKeyLayout();

function midiX(midi: number): number {
  const w = LAYOUT.whites.find((w) => w.midi === midi);
  if (w) return w.left + WHITE_KEY_WIDTH / 2;
  const b = LAYOUT.blacks.find((b) => b.midi === midi);
  return b ? b.left + BLACK_KEY_WIDTH / 2 : 0;
}

export function KeyboardPreview({ activeNotes, hintNotes, hintKey = 0 }: KeyboardPreviewProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [hintIndex, setHintIndex] = useState(-1);

  const activeSet = new Set(activeNotes);
  const visibleHintSet = new Set<number>();
  if (hintNotes && hintIndex >= 0) {
    for (let i = 0; i <= Math.min(hintIndex, hintNotes.length - 1); i += 1) {
      visibleHintSet.add(hintNotes[i]);
    }
  }

  // Center on C4 on mount — no demo wiggle.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const c4 = LAYOUT.whites.find((w) => w.midi === 60);
    if (!c4) return;
    const raf = requestAnimationFrame(() => {
      el.scrollLeft = Math.max(0, c4.left + WHITE_KEY_WIDTH / 2 - el.clientWidth / 2);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Auto-scroll active notes into view
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || activeNotes.length === 0) return;
    const sorted = [...activeNotes].sort((a, b) => a - b);
    const lowX = midiX(sorted[0]);
    const highX = midiX(sorted[sorted.length - 1]);
    const viewLeft = el.scrollLeft;
    const viewRight = viewLeft + el.clientWidth;
    if (lowX < viewLeft + 50 || highX > viewRight - 50) {
      const center = (lowX + highX) / 2 - el.clientWidth / 2;
      el.scrollTo({ left: Math.max(0, center), behavior: "smooth" });
    }
  }, [activeNotes]);

  // Drag-to-scroll + wheel-to-horizontal
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let isDown = false;
    let startX = 0;
    let startScrollLeft = 0;

    const onPointerDown = (e: PointerEvent) => {
      isDown = true;
      startX = e.clientX;
      startScrollLeft = el.scrollLeft;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDown) return;
      el.scrollLeft = startScrollLeft - (e.clientX - startX);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!isDown) return;
      isDown = false;
      el.releasePointerCapture(e.pointerId);
      el.style.cursor = "";
    };
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (e.deltaY === 0) return;
      e.preventDefault();
      el.scrollBy({ left: e.deltaY, behavior: "auto" });
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  // Fail tutorial: when hintKey changes, light each note in sequence
  useEffect(() => {
    if (!hintNotes || hintNotes.length === 0 || hintKey === 0) {
      setHintIndex(-1);
      return;
    }
    const el = scrollRef.current;
    if (el) {
      const lowX = midiX(hintNotes[0]);
      const highX = midiX(hintNotes[hintNotes.length - 1]);
      const center = (lowX + highX) / 2 - el.clientWidth / 2;
      el.scrollTo({ left: Math.max(0, center), behavior: "smooth" });
    }

    const timers: number[] = [];
    setHintIndex(-1);
    // Initial pause then arpeggiate one by one
    hintNotes.forEach((_, i) => {
      timers.push(window.setTimeout(() => setHintIndex(i), 500 + i * 380));
    });
    // Brief sustain showing the full chord
    timers.push(window.setTimeout(() => setHintIndex(hintNotes.length - 1), 500 + hintNotes.length * 380));
    // Fade out
    timers.push(window.setTimeout(() => setHintIndex(-1), 500 + hintNotes.length * 380 + 1400));

    return () => timers.forEach(window.clearTimeout);
  }, [hintKey, hintNotes]);

  const scrollBy = (delta: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <section className="keyboard-panel">
      <button
        type="button"
        className="piano-arrow piano-arrow-left"
        onClick={() => scrollBy(-WHITE_KEY_WIDTH * 7)}
        aria-label="Scroll piano left"
      >
        ‹
      </button>
      <div className="piano-scroll" ref={scrollRef}>
        <div className="piano-keys" style={{ width: LAYOUT.totalWidth, height: KEY_HEIGHT }}>
          {LAYOUT.whites.map(({ midi, left }) => {
            const isActive = activeSet.has(midi);
            const isHint = visibleHintSet.has(midi);
            const isCurrentHint = hintIndex >= 0 && hintNotes?.[hintIndex] === midi;
            const pc = normalizePitchClass(midi);
            const octave = Math.floor(midi / 12) - 1;
            const showLabel = pc === 0;
            return (
              <div
                key={midi}
                className={`pkey pkey-white ${isActive ? "pkey-active" : ""} ${isHint ? "pkey-hint" : ""} ${isCurrentHint ? "pkey-hint-now" : ""}`}
                style={{ left, width: WHITE_KEY_WIDTH, height: KEY_HEIGHT }}
              >
                {showLabel && <span className="pkey-label">C{octave}</span>}
              </div>
            );
          })}
          {LAYOUT.blacks.map(({ midi, left }) => {
            const isActive = activeSet.has(midi);
            const isHint = visibleHintSet.has(midi);
            const isCurrentHint = hintIndex >= 0 && hintNotes?.[hintIndex] === midi;
            return (
              <div
                key={midi}
                className={`pkey pkey-black ${isActive ? "pkey-active" : ""} ${isHint ? "pkey-hint" : ""} ${isCurrentHint ? "pkey-hint-now" : ""}`}
                style={{ left, width: BLACK_KEY_WIDTH, height: `${BLACK_HEIGHT_PCT}%` }}
              />
            );
          })}
        </div>
      </div>
      <button
        type="button"
        className="piano-arrow piano-arrow-right"
        onClick={() => scrollBy(WHITE_KEY_WIDTH * 7)}
        aria-label="Scroll piano right"
      >
        ›
      </button>
    </section>
  );
}
