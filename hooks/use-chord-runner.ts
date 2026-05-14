"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { createPromptSequence } from "@/lib/game/chord-prompts";
import { clamp, drainRateForLevel, GAME_CONSTANTS } from "@/lib/game/game-engine";
import { pitchClassesEqual } from "@/lib/music/chord-detection";
import { uniquePitchClasses } from "@/lib/music/note-names";
import type { Bullet, GameSnapshot, ObstaclePrompt } from "@/types/game";

type UseChordRunnerArgs = {
  activeNotes: number[];
  onClear?: () => void;
  onCrash?: () => void;
  onLevelUp?: (level: number) => void;
};

// Deterministic placeholder so SSR + client first render match
const initialPrompt: ObstaclePrompt = {
  id: "initial-C",
  root: 0,
  quality: "",
  pitchClasses: [0, 4, 7],
  notes: [60, 64, 67],
  accent: "lime"
};

function spawnInterval(level: number): number {
  // Slow cadence: ~5–7.5s at L1, narrowing as level climbs
  const min = Math.max(2.0, 5.0 - (level - 1) * 0.2);
  const max = Math.max(3.0, 7.5 - (level - 1) * 0.32);
  return min + Math.random() * (max - min);
}

function bulletSpeed(level: number): number {
  // Base drain ± 15% — gentler variance so bullets don't sneak up
  const base = drainRateForLevel(level);
  return base * (0.9 + Math.random() * 0.25);
}

function makeBullet(prompt: ObstaclePrompt, level: number, indexHint = 0): Bullet {
  return {
    id: `${prompt.id}-${Date.now()}-${indexHint}-${Math.floor(Math.random() * 1000)}`,
    prompt,
    progress: GAME_CONSTANTS.startProgress,
    speed: bulletSpeed(level)
  };
}

function buildIdleSnapshot(prompt: ObstaclePrompt): GameSnapshot {
  return {
    phase: "idle",
    score: 0,
    streak: 0,
    level: 1,
    bullets: [],
    holdProgress: 0,
    jumpProgress: 0,
    clearPulseId: 0,
    crashPulseId: 0,
    statusText: "",
    prompt
  };
}

export function useChordRunner({ activeNotes, onClear, onCrash, onLevelUp }: UseChordRunnerArgs) {
  const [snapshot, setSnapshot] = useState<GameSnapshot>(() => buildIdleSnapshot(initialPrompt));
  const queueRef = useRef<ObstaclePrompt[]>(createPromptSequence(1));
  const queueLevelRef = useRef<number>(1);
  const clearsInLevelRef = useRef<number>(0);
  const holdTimeRef = useRef(0);
  const jumpStartRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const spawnTimerRef = useRef<number>(0);

  const activePitchClasses = useMemo(() => uniquePitchClasses(activeNotes), [activeNotes]);

  function refreshQueueForLevel(level: number) {
    queueLevelRef.current = level;
    queueRef.current = createPromptSequence(level);
  }

  function pullNextPrompt(level = queueLevelRef.current): ObstaclePrompt {
    if (level !== queueLevelRef.current || !queueRef.current.length) {
      refreshQueueForLevel(level);
    }
    return queueRef.current.shift()!;
  }

  function startGame() {
    queueLevelRef.current = 1;
    queueRef.current = createPromptSequence(1);
    clearsInLevelRef.current = 0;
    holdTimeRef.current = 0;
    jumpStartRef.current = null;
    lastTickRef.current = null;
    spawnTimerRef.current = spawnInterval(1);

    const firstPrompt = pullNextPrompt(1);
    const firstBullet = makeBullet(firstPrompt, 1, 0);

    setSnapshot({
      phase: "running",
      score: 0,
      streak: 0,
      level: 1,
      bullets: [firstBullet],
      holdProgress: 0,
      jumpProgress: 0,
      clearPulseId: 0,
      crashPulseId: 0,
      statusText: "",
      prompt: firstPrompt
    });
  }

  function resetGame() {
    queueLevelRef.current = 1;
    queueRef.current = createPromptSequence(1);
    clearsInLevelRef.current = 0;
    holdTimeRef.current = 0;
    jumpStartRef.current = null;
    lastTickRef.current = null;
    spawnTimerRef.current = 0;
    setSnapshot(buildIdleSnapshot(initialPrompt));
  }

  function advanceLevel() {
    setSnapshot((current) => {
      if (current.phase !== "level-up") return current;
      const nextLvl = current.level + 1;
      refreshQueueForLevel(nextLvl);
      clearsInLevelRef.current = 0;
      holdTimeRef.current = 0;
      jumpStartRef.current = null;
      lastTickRef.current = null;
      spawnTimerRef.current = spawnInterval(nextLvl);

      const firstPrompt = pullNextPrompt(nextLvl);
      const firstBullet = makeBullet(firstPrompt, nextLvl, 0);

      return {
        ...current,
        phase: "running",
        level: nextLvl,
        bullets: [firstBullet],
        holdProgress: 0,
        jumpProgress: 0,
        prompt: firstPrompt
      };
    });
  }

  useEffect(() => {
    if (snapshot.phase !== "running") return;

    let frameId = 0;

    const tick = (timestamp: number) => {
      const previous = lastTickRef.current ?? timestamp;
      const deltaSeconds = Math.min(0.05, (timestamp - previous) / 1000);
      lastTickRef.current = timestamp;

      setSnapshot((current) => {
        if (current.phase !== "running") return current;

        // Move every bullet
        const advanced: Bullet[] = current.bullets.map((b) => ({
          ...b,
          progress: b.progress - b.speed * deltaSeconds
        }));

        // Sort by progress ascending — bullets[0] is the closest target
        advanced.sort((a, b) => a.progress - b.progress);
        const active = advanced[0];

        // Match logic: hold against the *active* (closest) bullet
        const matchesActive = active
          ? pitchClassesEqual(activePitchClasses, active.prompt.pitchClasses)
          : false;

        if (active && matchesActive && active.progress <= GAME_CONSTANTS.matchWindow) {
          holdTimeRef.current += deltaSeconds;
        } else if (!matchesActive) {
          holdTimeRef.current = Math.max(0, holdTimeRef.current - deltaSeconds * 1.6);
        }

        const holdProgress = clamp(holdTimeRef.current / GAME_CONSTANTS.holdTimeRequired, 0, 1);

        // Jump animation arc
        let jumpProgress = current.jumpProgress;
        if (jumpStartRef.current !== null) {
          const elapsed = (timestamp - jumpStartRef.current) / 1000;
          const t = clamp(elapsed / GAME_CONSTANTS.jumpDurationSec, 0, 1);
          jumpProgress = 4 * t * (1 - t);
          if (t >= 1) {
            jumpStartRef.current = null;
            jumpProgress = 0;
          }
        }

        // Did we clear the active bullet?
        if (active && holdProgress >= 1) {
          jumpStartRef.current = timestamp;
          holdTimeRef.current = 0;
          const nextScore = current.score + 1;
          const nextStreak = current.streak + 1;
          clearsInLevelRef.current += 1;
          const remaining = advanced.slice(1);

          onClear?.();

          if (clearsInLevelRef.current >= GAME_CONSTANTS.clearsPerLevel) {
            onLevelUp?.(current.level + 1);
            return {
              ...current,
              phase: "level-up",
              score: nextScore,
              streak: nextStreak,
              bullets: remaining,
              holdProgress: 0,
              jumpProgress: 0.1,
              clearPulseId: current.clearPulseId + 1,
              prompt: remaining[0]?.prompt ?? current.prompt
            };
          }

          return {
            ...current,
            score: nextScore,
            streak: nextStreak,
            bullets: remaining,
            holdProgress: 0,
            jumpProgress: 0.1,
            clearPulseId: current.clearPulseId + 1,
            prompt: remaining[0]?.prompt ?? current.prompt
          };
        }

        // Crash: closest uncleared bullet hit the player position
        if (active && active.progress <= GAME_CONSTANTS.playerPosition) {
          onCrash?.();
          return {
            ...current,
            phase: "game-over",
            bullets: advanced,
            holdProgress,
            jumpProgress: 0,
            streak: 0,
            crashPulseId: current.crashPulseId + 1
          };
        }

        // Spawn cadence — only when no level-up
        spawnTimerRef.current -= deltaSeconds;
        let bullets = advanced;
        if (spawnTimerRef.current <= 0 && bullets.length < 4) {
          const nextPrompt = pullNextPrompt(current.level);
          bullets = [...bullets, makeBullet(nextPrompt, current.level, bullets.length)];
          spawnTimerRef.current = spawnInterval(current.level);
        } else if (bullets.length === 0) {
          // Safety net: never let bullets array empty out while running
          const nextPrompt = pullNextPrompt(current.level);
          bullets = [makeBullet(nextPrompt, current.level, 0)];
          spawnTimerRef.current = spawnInterval(current.level);
        }

        // Re-sort if we appended
        if (bullets !== advanced) bullets.sort((a, b) => a.progress - b.progress);

        return {
          ...current,
          bullets,
          holdProgress,
          jumpProgress,
          prompt: bullets[0]?.prompt ?? current.prompt
        };
      });

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frameId);
      lastTickRef.current = null;
    };
  }, [activePitchClasses, snapshot.phase, onClear, onCrash, onLevelUp]);

  return {
    snapshot,
    startGame,
    resetGame,
    advanceLevel
  };
}
