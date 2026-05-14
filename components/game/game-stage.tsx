"use client";

import { useEffect, useRef, useState } from "react";
import type { GameSnapshot } from "@/types/game";
import { promptLabel } from "@/lib/game/chord-prompts";

type GameStageProps = {
  snapshot: GameSnapshot;
  preferFlats: boolean;
  showMidiHint?: boolean;
  onTapRestart?: () => void;
  onAdvance?: () => void;
};

const PLAYER_LEFT_PCT = 14;

export function GameStage({ snapshot, preferFlats, showMidiHint = false, onTapRestart, onAdvance }: GameStageProps) {
  const playerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    if (!playerRef.current) return;
    const lift = snapshot.jumpProgress * 180;
    const stretch = snapshot.jumpProgress * 0.18;
    const scaleX = 1 - stretch * 0.6;
    const scaleY = 1 + stretch;
    playerRef.current.style.transform = `translateY(${-lift}px) scale(${scaleX}, ${scaleY})`;
  }, [snapshot.jumpProgress]);

  useEffect(() => {
    if (!snapshot.clearPulseId) return;
    setBurstKey((k) => k + 1);
  }, [snapshot.clearPulseId]);

  useEffect(() => {
    if (!snapshot.crashPulseId) return;
    if (!stageRef.current) return;
    stageRef.current.classList.remove("stage-shake");
    void stageRef.current.offsetWidth;
    stageRef.current.classList.add("stage-shake");
  }, [snapshot.crashPulseId]);

  const matched = snapshot.holdProgress > 0;
  const canTapRestart = snapshot.phase === "game-over" && !!onTapRestart;

  return (
    <section className="stage-panel">
      <div
        ref={stageRef}
        className={`stage ${snapshot.phase === "game-over" ? "stage-over" : ""} ${canTapRestart ? "stage-tappable" : ""}`}
        onClick={canTapRestart ? onTapRestart : undefined}
        role={canTapRestart ? "button" : undefined}
        tabIndex={canTapRestart ? 0 : -1}
      >
        <div className="stage-sky">
          <div className="stage-stars" />
          <div className="cloud cloud-a" />
          <div className="cloud cloud-b" />
          <div className="cloud cloud-c" />
        </div>
        <div className="stage-mountains" />
        <div className="stage-grid" />
        <div className="stage-rails" />

        <div className="stage-target">
          <div className="stage-target-label">{promptLabel(snapshot.prompt, preferFlats)}</div>
          <div className={`stage-target-bar ${matched ? "stage-target-bar-on" : ""}`}>
            <div className="stage-target-bar-fill" style={{ width: `${snapshot.holdProgress * 100}%` }} />
          </div>
        </div>

        <div className="stage-meta">
          <div className="stage-level">Lv {snapshot.level}</div>
          <div className="stage-score">{snapshot.score}</div>
        </div>

        <div className="player-anchor" style={{ left: `${PLAYER_LEFT_PCT}%` }}>
          {burstKey > 0 && <div key={burstKey} className="clear-burst" />}
          <div className="player" ref={playerRef}>
            <div className="player-trail" />
            <div className="player-glow" />
            <div className="player-body">
              <span className="player-visor" />
              <span className="player-stripe" />
            </div>
            <div className="player-foot player-foot-front" />
            <div className="player-foot player-foot-back" />
          </div>
          <div
            className="player-shadow"
            style={{
              opacity: 1 - snapshot.jumpProgress * 0.8,
              transform: `translateX(-50%) scaleX(${1 - snapshot.jumpProgress * 0.4})`
            }}
          />
        </div>

        <div className="bullet-track">
          {snapshot.bullets.map((b, i) => {
            const isActive = i === 0;
            const distance = Math.max(0, b.progress - PLAYER_LEFT_PCT);
            return (
              <div
                key={b.id}
                className={`bullet ${isActive ? "bullet-active" : ""}`}
                style={{
                  left: `${b.progress}%`,
                  opacity: isActive ? 1 : 0.72,
                  transform: `translateX(-50%) scale(${isActive ? 1 : 0.86})`,
                  filter: isActive ? "none" : `blur(${Math.min(1.2, distance * 0.02)}px)`
                }}
              >
                <span className="bullet-trail" />
                <span className="bullet-core">
                  <span className="bullet-label">{promptLabel(b.prompt, preferFlats)}</span>
                </span>
                <span className="bullet-tip" />
              </div>
            );
          })}
        </div>

        <div className="ground" />

        {snapshot.phase === "idle" && (
          <div className="stage-overlay">
            <div className="stage-overlay-card stage-overlay-card-ready">
              <h2 className="overlay-title">Ready</h2>
              <div className="overlay-controls">
                <span className="overlay-kbd">Space</span>
                <span className="overlay-kbd-label">to start</span>
              </div>
              {showMidiHint && (
                <div className="midi-hint">
                  <span className="midi-hint-dot" />
                  Connect your MIDI keyboard first
                </div>
              )}
            </div>
          </div>
        )}

        {snapshot.phase === "level-up" && (
          <div className="stage-overlay">
            <div className="stage-overlay-card stage-overlay-card-levelup">
              <span className="overlay-eyebrow">Level {snapshot.level} cleared</span>
              <div className="overlay-big-score">{snapshot.score}</div>
              <p>New chord type unlocks next</p>
              <button type="button" className="overlay-btn" onClick={onAdvance}>
                Advance → Level {snapshot.level + 1}
              </button>
            </div>
          </div>
        )}

        {snapshot.phase === "game-over" && (
          <div className="stage-overlay">
            <div className="stage-overlay-card stage-overlay-card-fail">
              <div className="overlay-big-score">{snapshot.score}</div>
              <p>Tap anywhere to restart</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
