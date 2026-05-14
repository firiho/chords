"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { MobileBlock } from "@/components/layout/mobile-block";
import { TopBar } from "@/components/layout/top-bar";
import { FallingTiles } from "@/components/play/falling-tiles";
import { PlayPiano } from "@/components/play/play-piano";
import { useMidiInput } from "@/hooks/use-midi-input";
import { useMidiSynth } from "@/hooks/use-midi-synth";
import { useTileGame } from "@/hooks/use-tile-game";
import { loadMidiAsSong } from "@/lib/play/midi-loader";
import {
  findLibraryEntry,
  SONG_LIBRARY,
  songLibraryId,
  songLibraryTitle,
  type Song
} from "@/lib/play/songs";

// Cache for MIDI-loaded songs — survives navigation; only re-parses on hard reload.
const MIDI_SONG_CACHE_KEY = "__chordsMidiSongCache";
function getMidiSongCache(): Map<string, Song> {
  const g = globalThis as unknown as Record<string, Map<string, Song> | undefined>;
  if (!g[MIDI_SONG_CACHE_KEY]) g[MIDI_SONG_CACHE_KEY] = new Map();
  return g[MIDI_SONG_CACHE_KEY]!;
}

export function PlayApp() {
  const firstEntryId = songLibraryId(SONG_LIBRARY[0]);
  const [songId, setSongId] = useState<string>(firstEntryId);
  const [song, setSong] = useState<Song | null>(null);
  const [songLoading, setSongLoading] = useState<boolean>(false);
  const [songError, setSongError] = useState<string | null>(null);

  // Resolve the selected library entry: fetch + parse on miss, instant on cache hit.
  useEffect(() => {
    let cancelled = false;
    const entry = findLibraryEntry(songId);
    if (!entry) return;
    setSongError(null);

    const cache = getMidiSongCache();
    const cached = cache.get(entry.descriptor.id);
    if (cached) {
      setSong(cached);
      setSongLoading(false);
      return;
    }

    setSongLoading(true);
    loadMidiAsSong(entry.descriptor)
      .then((loaded) => {
        cache.set(entry.descriptor.id, loaded);
        if (cancelled) return;
        setSong(loaded);
        setSongLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setSongError(err instanceof Error ? err.message : "Failed to load song");
        setSongLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [songId]);

  const handleNoteRef = useRef<(midi: number) => void>(() => {});
  const triggerNoteRef = useRef<(note: number, on: boolean) => void>(() => {});

  const { activeNotes, chord, connectMidi, inputs, midiSupported, preferFlats, setPreferFlats } = useMidiInput({
    onNoteEvent: (note, on) => {
      if (on) handleNoteRef.current(note);
      triggerNoteRef.current(note, on);
    }
  });

  const { audioEnabled, toggleAudio, noteVolume, setNoteVolume, triggerNote } = useMidiSynth(activeNotes);
  triggerNoteRef.current = triggerNote;

  // Auto-play: when on, the synth plays each tile when it reaches the hit line.
  const [autoPlay, setAutoPlay] = useState(false);
  const autoPlayRef = useRef(autoPlay);
  autoPlayRef.current = autoPlay;

  // Playback speed — applied at game start. 1 = original, 0.5 = half, etc.
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const { snapshot, startGame, resetGame, pauseGame, resumeGame, handleNoteOn, travelSec } = useTileGame({
    song,
    speed: playbackSpeed,
    onTileReached: (tile) => {
      if (!autoPlayRef.current) return;
      triggerNoteRef.current(tile.midi, true);
      const offMs = Math.max(120, tile.duration * 1000);
      window.setTimeout(() => triggerNoteRef.current(tile.midi, false), offMs);
    }
  });
  handleNoteRef.current = handleNoteOn;

  const midiReady = inputs.length > 0;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (snapshot.phase === "playing") pauseGame();
        else if (snapshot.phase === "paused") resumeGame();
        else if (song && !songLoading) startGame();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [snapshot.phase, song, songLoading, startGame, pauseGame, resumeGame]);

  // Notes whose tile is currently in (or near) the hit window — used to dim-highlight piano keys.
  const highlighted = useMemo(() => {
    const result: number[] = [];
    for (const t of snapshot.tiles) {
      if (t.status !== "pending") continue;
      const delta = t.targetTime - snapshot.currentTime;
      if (delta < 0.16 && delta > -0.16) result.push(t.midi);
    }
    return result;
  }, [snapshot.tiles, snapshot.currentTime]);

  // For each held note, classify the spotlight: correct (just hit a tile), wrong (no tile to hit), or pending.
  const lanes = useMemo(() => {
    return activeNotes.map((midi) => {
      const recentHit = snapshot.tiles.some(
        (t) => t.status === "hit" && t.midi === midi && snapshot.currentTime - t.targetTime < 0.4
      );
      if (recentHit) return { midi, kind: "correct" as const };

      const tileNear = snapshot.tiles.some(
        (t) => t.status === "pending" && t.midi === midi && Math.abs(t.targetTime - snapshot.currentTime) < 0.25
      );
      if (!tileNear && snapshot.phase === "playing") return { midi, kind: "wrong" as const };

      return { midi, kind: "pending" as const };
    });
  }, [activeNotes, snapshot.tiles, snapshot.currentTime, snapshot.phase]);

  const isPlaying = snapshot.phase === "playing";
  const isPaused = snapshot.phase === "paused";
  const isEnded = snapshot.phase === "ended";

  const accuracy = snapshot.hits + snapshot.misses === 0
    ? 0
    : Math.round((snapshot.hits / (snapshot.hits + snapshot.misses)) * 100);

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
          actionButton={
            isPlaying
              ? { label: "Pause", onClick: pauseGame, title: "Pause (Space)" }
              : isPaused
                ? { label: "Resume", onClick: resumeGame, title: "Resume (Space)" }
                : { label: isEnded ? "Play" : "Start", onClick: startGame, title: "Start (Space)" }
          }
        />

        <section className="play-area">
          <section className="play-stage">
            <div className="play-stage-hud">
              <div className="hud-cluster hud-cluster-settings">
                <label className="hud-field">
                  <span className="hud-field-label">Song</span>
                  <span className="hud-select-wrap">
                    <select
                      value={songId}
                      onChange={(e) => setSongId(e.target.value)}
                      className="hud-select"
                      disabled={songLoading}
                    >
                      {SONG_LIBRARY.map((entry) => {
                        const id = songLibraryId(entry);
                        return (
                          <option key={id} value={id}>{songLibraryTitle(entry)}</option>
                        );
                      })}
                    </select>
                  </span>
                </label>
                <label className="hud-field hud-field-narrow">
                  <span className="hud-field-label">Speed</span>
                  <span className="hud-select-wrap">
                    <select
                      value={playbackSpeed}
                      onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                      className="hud-select"
                      title="Slows or speeds up the song. Applied when you press Start."
                    >
                      <option value={0.4}>0.4×</option>
                      <option value={0.5}>0.5×</option>
                      <option value={0.65}>0.65×</option>
                      <option value={0.8}>0.8×</option>
                      <option value={1}>1×</option>
                      <option value={1.25}>1.25×</option>
                      <option value={1.5}>1.5×</option>
                    </select>
                  </span>
                </label>
              </div>

              <div className="hud-divider" aria-hidden />

              <div className="hud-cluster hud-cluster-stats">
                <div className="hud-stat">
                  <span className="hud-stat-label">Score</span>
                  <span className="hud-stat-value">{snapshot.score}</span>
                </div>
                <div className="hud-stat">
                  <span className="hud-stat-label">Combo</span>
                  <span className="hud-stat-value">×{snapshot.combo}</span>
                </div>
                <div className="hud-stat">
                  <span className="hud-stat-label">Accuracy</span>
                  <span className="hud-stat-value">{accuracy}%</span>
                </div>
              </div>

              <div className="hud-divider" aria-hidden />

              <div className="hud-cluster hud-cluster-actions">
                <button
                  type="button"
                  className={`hud-toggle ${autoPlay ? "hud-toggle-on" : ""}`}
                  onClick={() => setAutoPlay((v) => !v)}
                  title="Listen: synth plays each tile so you can hear the song"
                >
                  <span className="hud-toggle-dot" />
                  Listen
                </button>
                {(isPlaying || isPaused) && (
                  <button
                    type="button"
                    className="hud-action"
                    onClick={resetGame}
                    title="Restart song"
                  >
                    Restart
                  </button>
                )}
              </div>
            </div>

            <div className="play-board">
              <FallingTiles
                tiles={snapshot.tiles}
                currentTime={snapshot.currentTime}
                travelSec={travelSec}
                litNotes={lanes}
              />
            </div>

            {isPaused && (
              <div className="stage-overlay">
                <div className="stage-overlay-card">
                  <span className="overlay-eyebrow">Paused</span>
                  <h2 className="overlay-title">Paused</h2>
                  <div className="overlay-controls">
                    <span className="overlay-kbd">Space</span>
                    <span className="overlay-kbd-label">to resume</span>
                  </div>
                </div>
              </div>
            )}

            {snapshot.phase === "idle" && (
              <div className="stage-overlay">
                <div className="stage-overlay-card stage-overlay-card-ready">
                  <h2 className="overlay-title">{songLoading ? "Loading…" : "Ready"}</h2>
                  {songError && (
                    <p style={{ color: "var(--warn)" }}>{songError}</p>
                  )}
                  <label className="overlay-song-picker">
                    <span className="overlay-song-picker-label">Song</span>
                    <select
                      value={songId}
                      onChange={(e) => setSongId(e.target.value)}
                      className="overlay-song-select"
                      disabled={songLoading}
                    >
                      {SONG_LIBRARY.map((entry) => {
                        const id = songLibraryId(entry);
                        return (
                          <option key={id} value={id}>{songLibraryTitle(entry)}</option>
                        );
                      })}
                    </select>
                  </label>
                  <div className="overlay-controls">
                    <span className="overlay-kbd">Space</span>
                    <span className="overlay-kbd-label">to play</span>
                  </div>
                  {!midiReady && (
                    <div className="midi-hint">
                      <span className="midi-hint-dot" />
                      Connect your MIDI keyboard first
                    </div>
                  )}
                </div>
              </div>
            )}

            {isEnded && (
              <div className="stage-overlay">
                <div className="stage-overlay-card">
                  <span className="overlay-eyebrow">
                    {snapshot.misses === 0 ? "Perfect run" : "Song complete"}
                  </span>
                  <div className="overlay-big-score">{snapshot.score}</div>
                  <p>{snapshot.hits} hits · {snapshot.misses} misses · best combo {snapshot.bestCombo}</p>
                  <label className="overlay-song-picker">
                    <span className="overlay-song-picker-label">Song</span>
                    <select
                      value={songId}
                      onChange={(e) => setSongId(e.target.value)}
                      className="overlay-song-select"
                      disabled={songLoading}
                    >
                      {SONG_LIBRARY.map((entry) => {
                        const id = songLibraryId(entry);
                        return (
                          <option key={id} value={id}>{songLibraryTitle(entry)}</option>
                        );
                      })}
                    </select>
                  </label>
                  <button type="button" className="overlay-btn" onClick={startGame}>
                    Play
                  </button>
                </div>
              </div>
            )}
          </section>

          <div className="piano-host">
            <PlayPiano activeNotes={activeNotes} highlightedNotes={highlighted} />
          </div>
        </section>
      </main>
    </>
  );
}
