"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { MobileBlock } from "@/components/layout/mobile-block";
import { TopBar } from "@/components/layout/top-bar";
import { GameStage } from "@/components/game/game-stage";
import { KeyboardPreview } from "@/components/game/keyboard-preview";
import { useChordRunner } from "@/hooks/use-chord-runner";
import { useMidiInput } from "@/hooks/use-midi-input";
import { useMidiSynth } from "@/hooks/use-midi-synth";

type SfxKind = "jump" | "score" | "fail";

export function ChordRunnerApp() {
  const triggerNoteRef = useRef<(note: number, on: boolean) => void>(() => {});

  const { activeNotes, chord, connectMidi, inputs, midiSupported, preferFlats, setPreferFlats } = useMidiInput({
    onNoteEvent: (note, on) => triggerNoteRef.current(note, on)
  });

  const playSfxRef = useRef<(kind: SfxKind) => void>(() => {});
  const [midiToast, setMidiToast] = useState(false);

  const handleClear = useCallback(() => {
    playSfxRef.current("jump");
    setTimeout(() => playSfxRef.current("score"), 90);
  }, []);
  const handleCrash = useCallback(() => {
    playSfxRef.current("fail");
  }, []);

  const { snapshot, resetGame, startGame, advanceLevel } = useChordRunner({
    activeNotes,
    onClear: handleClear,
    onCrash: handleCrash
  });

  const { audioEnabled, toggleAudio, playSfx, noteVolume, setNoteVolume, triggerNote } = useMidiSynth(activeNotes);
  playSfxRef.current = playSfx;
  triggerNoteRef.current = triggerNote;

  const midiReady = inputs.length > 0;

  const tryStart = useCallback(() => {
    if (!midiReady) {
      setMidiToast(true);
      setTimeout(() => setMidiToast(false), 3200);
      // Still attempt to request access — first click may pop the perm dialog.
      connectMidi();
      return;
    }
    if (snapshot.phase === "running") resetGame();
    else startGame();
  }, [midiReady, snapshot.phase, resetGame, startGame, connectMidi]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        tryStart();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tryStart]);

  const showMidiHint = !midiReady && snapshot.phase === "idle";

  // Fail tutorial: on phase change to game-over, push the failed prompt's notes to the piano
  const [pianoHintNotes, setPianoHintNotes] = useState<number[]>([]);
  const [pianoHintKey, setPianoHintKey] = useState(0);
  useEffect(() => {
    if (snapshot.phase !== "game-over") return;
    setPianoHintNotes([...snapshot.prompt.notes].sort((a, b) => a - b));
    setPianoHintKey((k) => k + 1);
  }, [snapshot.phase, snapshot.crashPulseId, snapshot.prompt.notes]);

  return (
    <>
      <MobileBlock />
      <main className="page-shell">
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
        actionButton={{
          label: snapshot.phase === "running" ? "Restart" : "Start",
          onClick: tryStart,
          title: snapshot.phase === "running" ? "Restart (Space)" : "Start (Space)"
        }}
      />

      <section className="play-area">
        <GameStage
          snapshot={snapshot}
          preferFlats={preferFlats}
          showMidiHint={showMidiHint}
          onTapRestart={startGame}
          onAdvance={advanceLevel}
        />

        <div className="piano-host">
          <KeyboardPreview
            activeNotes={activeNotes}
            hintNotes={pianoHintNotes}
            hintKey={pianoHintKey}
          />
        </div>
      </section>

        {midiToast && (
          <div className="toast">
            <span className="toast-dot" />
            Connect your MIDI keyboard before starting
          </div>
        )}
      </main>
    </>
  );
}
