"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Dispatch, SetStateAction } from "react";

import Logo from "@/components/logo/logo";
import type { ChordDetectionResult } from "@/types/music";

type TopBarProps = {
  midiReady: boolean;
  midiSupported: boolean;
  connectMidi: () => Promise<void>;
  audioEnabled: boolean;
  toggleAudio: () => void;
  noteVolume: number;
  setNoteVolume: (v: number) => void;
  preferFlats: boolean;
  setPreferFlats: Dispatch<SetStateAction<boolean>>;
  chord: Pick<ChordDetectionResult, "primary">;
  /** Optional rightmost action button (e.g. Start / Restart) */
  actionButton?: { label: string; onClick: () => void; title?: string };
};

export function TopBar({
  midiReady,
  midiSupported,
  connectMidi,
  audioEnabled,
  toggleAudio,
  noteVolume,
  setNoteVolume,
  preferFlats,
  setPreferFlats,
  chord,
  actionButton
}: TopBarProps) {
  const pathname = usePathname();
  const showChord = chord.primary !== "";

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <Link href="/" className="brand brand-link">
          <div className="brand-mark">
            <Logo />
          </div>
          <div className="brand-text">
            <strong>Chords</strong>
          </div>
        </Link>
        <nav className="nav-tabs" aria-label="Pages">
          <Link href="/" className={`nav-tab ${pathname === "/" ? "is-active" : ""}`}>Runner</Link>
          <Link href="/play" className={`nav-tab ${pathname === "/play" ? "is-active" : ""}`}>Play</Link>
          <Link href="/sounds" className={`nav-tab ${pathname === "/sounds" ? "is-active" : ""}`}>Sounds</Link>
        </nav>
      </div>

      <div className="header-held" aria-live="polite">
        <span className={`header-held-value ${showChord ? "" : "is-empty"}`}>
          {showChord ? chord.primary : ""}
        </span>
      </div>

      <div className="top-controls">
        <button
          className={`icon-btn ${midiReady ? "icon-btn-live" : ""}`}
          onClick={connectMidi}
          title={midiSupported ? (midiReady ? "MIDI connected" : "Connect MIDI") : "Web MIDI unsupported"}
        >
          <span className="icon-btn-dot" />
          <span className="icon-btn-text">MIDI</span>
        </button>
        <button
          className={`icon-btn ${audioEnabled ? "icon-btn-live" : ""}`}
          onClick={toggleAudio}
          title={audioEnabled ? "Mute audio" : "Unmute audio"}
        >
          <span className="icon-btn-text">{audioEnabled ? "♪ On" : "Muted"}</span>
        </button>
        <label className="volume-slider" title="Note volume">
          <span className="volume-slider-icon">vol</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={noteVolume}
            onChange={(e) => setNoteVolume(parseFloat(e.target.value))}
            disabled={!audioEnabled}
            aria-label="Note volume"
          />
        </label>
        <button
          className="icon-btn"
          onClick={() => setPreferFlats((v) => !v)}
          title="Sharps / flats"
        >
          <span className="icon-btn-text">{preferFlats ? "♭" : "♯"}</span>
        </button>
        {actionButton && (
          <button
            className="icon-btn icon-btn-primary"
            onClick={actionButton.onClick}
            title={actionButton.title ?? actionButton.label}
          >
            <span className="icon-btn-text">{actionButton.label}</span>
          </button>
        )}
      </div>
    </header>
  );
}
