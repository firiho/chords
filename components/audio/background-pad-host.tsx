"use client";

import { useEffect } from "react";

import {
  ensurePadInitialized,
  setPadAccompaniment,
  setPadChord,
  setPadVolume
} from "@/lib/audio/background-pad";
import {
  getAccompanimentEnabled,
  getVolume,
  hydrateFromStorage,
  subscribeAccompaniment,
  subscribeVolume
} from "@/lib/audio/voice-source";
import { useMidiInput } from "@/hooks/use-midi-input";

/**
 * Mounted in the root layout. Owns the global background-pad subscriptions:
 * - first user gesture spins up the AudioContext
 * - accompaniment toggle starts/stops the pad
 * - volume slider scales the pad bus
 * - MIDI chord detection retunes the pad
 * Lives across page navigation, so the pad keeps playing on /sounds.
 */
export function BackgroundPadHost() {
  const { chord } = useMidiInput();

  // First-user-gesture init + subscription wiring
  useEffect(() => {
    hydrateFromStorage();
    setPadAccompaniment(getAccompanimentEnabled());
    setPadVolume(getVolume());

    let initialized = false;
    const init = async () => {
      if (initialized) return;
      initialized = true;
      await ensurePadInitialized();
      setPadAccompaniment(getAccompanimentEnabled());
      setPadVolume(getVolume());
      window.removeEventListener("pointerdown", init);
      window.removeEventListener("keydown", init);
    };
    window.addEventListener("pointerdown", init);
    window.addEventListener("keydown", init);

    const unsubAccomp = subscribeAccompaniment(setPadAccompaniment);
    const unsubVolume = subscribeVolume(setPadVolume);

    return () => {
      unsubAccomp();
      unsubVolume();
      window.removeEventListener("pointerdown", init);
      window.removeEventListener("keydown", init);
    };
  }, []);

  // Retune pad whenever the played chord changes
  useEffect(() => {
    if (chord.root === null) return;
    setPadChord(chord.root, chord.quality);
  }, [chord.root, chord.quality]);

  return null;
}
