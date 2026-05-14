"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Song, SongNote } from "@/lib/play/songs";

export type TileStatus = "pending" | "hit" | "missed";

export type Tile = {
  id: string;
  midi: number;
  spawnTime: number; // seconds from game start when tile begins falling
  targetTime: number; // seconds from game start when tile reaches the hit line
  duration: number; // seconds — how long the note should sustain
  status: TileStatus;
};

export type TilePhase = "idle" | "playing" | "paused" | "ended";

export type TileSnapshot = {
  phase: TilePhase;
  songId: string | null;
  currentTime: number; // seconds since start
  tiles: Tile[];
  score: number;
  hits: number;
  misses: number;
  combo: number;
  bestCombo: number;
};

const TILE_TRAVEL_SEC = 2.6; // how long a tile spends falling
const HIT_WINDOW_SEC = 0.18; // ±180ms tolerance

function buildTiles(song: Song, speed: number): Tile[] {
  // speed < 1 = slower (timings stretched). speed > 1 = faster (timings squished).
  const factor = 1 / Math.max(0.1, speed);
  return song.notes.map((n, i) => ({
    id: `tile-${i}`,
    midi: n.midi,
    spawnTime: n.t * factor,
    targetTime: n.t * factor + TILE_TRAVEL_SEC,
    duration: Math.max(0.12, n.d * factor),
    status: "pending"
  }));
}

export type UseTileGameArgs = {
  song: Song | null;
  /** Playback speed multiplier. 1.0 = original, 0.5 = half speed, 1.5 = faster. */
  speed?: number;
  /** Called once when each tile reaches the hit line. Use for auto-play / demo mode. */
  onTileReached?: (tile: Tile) => void;
};

export function useTileGame({ song, speed = 1, onTileReached }: UseTileGameArgs) {
  const [snapshot, setSnapshot] = useState<TileSnapshot>({
    phase: "idle",
    songId: song?.id ?? null,
    currentTime: 0,
    tiles: song ? buildTiles(song, speed) : [],
    score: 0,
    hits: 0,
    misses: 0,
    combo: 0,
    bestCombo: 0
  });

  // Two-part clock so we can pause: `playStartedAt` is performance.now() of the most
  // recent resume; `accumulated` is the total game time before that resume.
  const playStartedAtRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);
  const tilesRef = useRef<Tile[]>(snapshot.tiles);
  const phaseRef = useRef<TilePhase>(snapshot.phase);
  const counters = useRef({ score: 0, hits: 0, misses: 0, combo: 0, bestCombo: 0 });
  const onTileReachedRef = useRef(onTileReached);
  onTileReachedRef.current = onTileReached;
  const reachedFiredRef = useRef(new Set<string>());

  const nowSec = () => {
    const started = playStartedAtRef.current;
    if (started === null) return accumulatedRef.current;
    return accumulatedRef.current + (performance.now() - started) / 1000;
  };

  // Re-seed tiles when the song changes
  useEffect(() => {
    const tiles = song ? buildTiles(song, speed) : [];
    tilesRef.current = tiles;
    counters.current = { score: 0, hits: 0, misses: 0, combo: 0, bestCombo: 0 };
    reachedFiredRef.current.clear();
    playStartedAtRef.current = null;
    accumulatedRef.current = 0;
    phaseRef.current = "idle";
    setSnapshot({
      phase: "idle",
      songId: song?.id ?? null,
      currentTime: 0,
      tiles,
      score: 0,
      hits: 0,
      misses: 0,
      combo: 0,
      bestCombo: 0
    });
  }, [song?.id, speed]);

  const startGame = useCallback(() => {
    if (!song) return;
    const tiles = buildTiles(song, speed);
    tilesRef.current = tiles;
    counters.current = { score: 0, hits: 0, misses: 0, combo: 0, bestCombo: 0 };
    reachedFiredRef.current.clear();
    accumulatedRef.current = 0;
    playStartedAtRef.current = performance.now();
    phaseRef.current = "playing";
    setSnapshot({
      phase: "playing",
      songId: song.id,
      currentTime: 0,
      tiles,
      score: 0,
      hits: 0,
      misses: 0,
      combo: 0,
      bestCombo: 0
    });
  }, [song, speed]);

  const resetGame = useCallback(() => {
    if (!song) return;
    const tiles = buildTiles(song, speed);
    tilesRef.current = tiles;
    counters.current = { score: 0, hits: 0, misses: 0, combo: 0, bestCombo: 0 };
    reachedFiredRef.current.clear();
    playStartedAtRef.current = null;
    accumulatedRef.current = 0;
    phaseRef.current = "idle";
    setSnapshot({
      phase: "idle",
      songId: song.id,
      currentTime: 0,
      tiles,
      score: 0,
      hits: 0,
      misses: 0,
      combo: 0,
      bestCombo: 0
    });
  }, [song, speed]);

  const pauseGame = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    if (playStartedAtRef.current !== null) {
      accumulatedRef.current += (performance.now() - playStartedAtRef.current) / 1000;
      playStartedAtRef.current = null;
    }
    phaseRef.current = "paused";
    setSnapshot((prev) => ({ ...prev, phase: "paused" }));
  }, []);

  const resumeGame = useCallback(() => {
    if (phaseRef.current !== "paused") return;
    playStartedAtRef.current = performance.now();
    phaseRef.current = "playing";
    setSnapshot((prev) => ({ ...prev, phase: "playing" }));
  }, []);

  // Direct-fire from MIDI: try to hit any tile near the hit line for this note.
  const handleNoteOn = useCallback((midi: number) => {
    if (phaseRef.current !== "playing") return;
    if (playStartedAtRef.current === null) return;
    const now = nowSec();

    const tiles = tilesRef.current;
    // Find best candidate — pending tile with this midi closest to hit window
    let best: Tile | null = null;
    let bestDelta = Infinity;
    for (const t of tiles) {
      if (t.status !== "pending") continue;
      if (t.midi !== midi) continue;
      const delta = Math.abs(t.targetTime - now);
      if (delta < bestDelta && delta <= HIT_WINDOW_SEC) {
        best = t;
        bestDelta = delta;
      }
    }
    if (!best) return;

    best.status = "hit";
    counters.current.hits += 1;
    counters.current.combo += 1;
    counters.current.bestCombo = Math.max(counters.current.bestCombo, counters.current.combo);
    // Score: 100 base + accuracy bonus up to +50 + combo bonus
    const accuracy = Math.max(0, 1 - bestDelta / HIT_WINDOW_SEC);
    counters.current.score += Math.round(100 + accuracy * 50 + counters.current.combo * 2);
  }, []);

  // Game loop: drives currentTime and flags missed tiles
  useEffect(() => {
    if (snapshot.phase !== "playing") return;

    let rafId = 0;
    const tick = () => {
      if (playStartedAtRef.current === null) return;
      const now = nowSec();

      // Fire onTileReached once when a tile crosses the hit line (used by auto-play)
      for (const t of tilesRef.current) {
        if (t.status !== "pending") continue;
        if (reachedFiredRef.current.has(t.id)) continue;
        if (now >= t.targetTime) {
          reachedFiredRef.current.add(t.id);
          onTileReachedRef.current?.(t);
        }
      }

      // Mark missed tiles
      let anyMissed = false;
      for (const t of tilesRef.current) {
        if (t.status !== "pending") continue;
        if (now > t.targetTime + HIT_WINDOW_SEC) {
          t.status = "missed";
          counters.current.misses += 1;
          counters.current.combo = 0;
          anyMissed = true;
        }
      }

      const totalProcessed = counters.current.hits + counters.current.misses;
      const isEnded = totalProcessed >= tilesRef.current.length;

      setSnapshot((prev) => ({
        ...prev,
        phase: isEnded ? "ended" : "playing",
        currentTime: now,
        tiles: anyMissed ? [...tilesRef.current] : prev.tiles,
        score: counters.current.score,
        hits: counters.current.hits,
        misses: counters.current.misses,
        combo: counters.current.combo,
        bestCombo: counters.current.bestCombo
      }));

      if (isEnded) {
        phaseRef.current = "ended";
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [snapshot.phase]);

  return {
    snapshot,
    startGame,
    resetGame,
    pauseGame,
    resumeGame,
    handleNoteOn,
    travelSec: TILE_TRAVEL_SEC,
    hitWindowSec: HIT_WINDOW_SEC
  };
}
