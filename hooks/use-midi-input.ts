"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { detectChord } from "@/lib/music/chord-detection";
import type { MidiInputSummary } from "@/types/music";

type UseMidiInputArgs = {
  onNoteEvent?: (note: number, on: boolean, velocity: number) => void;
};

type UseMidiInputResult = {
  activeNotes: number[];
  chord: ReturnType<typeof detectChord>;
  connectMidi: () => Promise<void>;
  clearNotes: () => void;
  inputs: MidiInputSummary[];
  midiSupported: boolean;
  preferFlats: boolean;
  setPreferFlats: Dispatch<SetStateAction<boolean>>;
  status: string;
};

type Listener = {
  onNotes: (notes: number[]) => void;
  onInputs: (inputs: MidiInputSummary[]) => void;
  onStatus: (status: string) => void;
  onNoteEvent?: (note: number, on: boolean, velocity: number) => void;
};

type Store = {
  midiAccess: MIDIAccess | null;
  inputs: MidiInputSummary[];
  status: string;
  activeSet: Set<number>;
  listeners: Set<Listener>;
};

// =========================================================================
// Shared MIDI state lives on globalThis so it survives:
//   - client-side route changes (component unmounts)
//   - Next.js Fast Refresh / HMR (which can re-evaluate module variables)
// Only a hard page refresh resets it.
// =========================================================================

const STORE_KEY = "__chordsMidiStore";

function getStore(): Store {
  const g = globalThis as unknown as Record<string, Store | undefined>;
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = {
      midiAccess: null,
      inputs: [],
      status: "Connect your MIDI keyboard to start the run.",
      activeSet: new Set<number>(),
      listeners: new Set<Listener>()
    };
  }
  return g[STORE_KEY]!;
}

function snapshotNotes(): number[] {
  return [...getStore().activeSet].sort((a, b) => a - b);
}

function broadcastNotes() {
  const notes = snapshotNotes();
  getStore().listeners.forEach((l) => l.onNotes(notes));
}

function broadcastInputs() {
  const store = getStore();
  store.listeners.forEach((l) => l.onInputs(store.inputs));
}

function broadcastStatus() {
  const store = getStore();
  store.listeners.forEach((l) => l.onStatus(store.status));
}

function handleMidiMessage(event: MIDIMessageEvent) {
  if (!event.data) return;
  const statusByte = event.data[0];
  const noteNumber = event.data[1];
  const velocity = event.data[2];
  const command = statusByte & 0xf0;
  const isNoteOn = command === 0x90 && velocity > 0;
  const isNoteOff = command === 0x80 || (command === 0x90 && velocity === 0);

  const store = getStore();
  if (isNoteOn) {
    store.activeSet.add(noteNumber);
    store.listeners.forEach((l) => l.onNoteEvent?.(noteNumber, true, velocity));
  }
  if (isNoteOff) {
    store.activeSet.delete(noteNumber);
    store.listeners.forEach((l) => l.onNoteEvent?.(noteNumber, false, velocity));
  }
  broadcastNotes();
}

function attachInputListeners() {
  const store = getStore();
  if (!store.midiAccess) return;
  for (const input of store.midiAccess.inputs.values()) {
    input.onmidimessage = handleMidiMessage;
  }
}

function refreshInputsList() {
  const store = getStore();
  if (!store.midiAccess) return;
  store.inputs = [...store.midiAccess.inputs.values()].map((input) => ({
    id: input.id,
    name: input.name || "Unnamed MIDI input",
    manufacturer: input.manufacturer || "Unknown maker",
    state: input.state
  }));
  store.status = store.inputs.length
    ? "MIDI ready. Hold the target chord to clear each obstacle."
    : "No MIDI inputs found yet.";
  broadcastInputs();
  broadcastStatus();
}

async function connectMidiShared(): Promise<void> {
  const store = getStore();
  if (store.midiAccess) {
    attachInputListeners();
    refreshInputsList();
    return;
  }

  const requestMidiAccess = navigator.requestMIDIAccess;
  if (!requestMidiAccess) {
    store.status = "Web MIDI is not supported here. Use desktop Chrome or Edge.";
    broadcastStatus();
    return;
  }

  try {
    const access = await requestMidiAccess.call(navigator, { sysex: false });
    store.midiAccess = access;
    attachInputListeners();
    refreshInputsList();
    access.onstatechange = () => {
      attachInputListeners();
      refreshInputsList();
    };
  } catch {
    store.status = "MIDI permission was blocked or failed. Refresh and allow access.";
    broadcastStatus();
  }
}

function clearNotesShared() {
  getStore().activeSet.clear();
  broadcastNotes();
}

// =========================================================================
// Hook
// =========================================================================

export function useMidiInput({ onNoteEvent }: UseMidiInputArgs = {}): UseMidiInputResult {
  const [midiSupported, setMidiSupported] = useState(true);
  const [status, setStatus] = useState<string>(() => getStore().status);
  const [inputs, setInputs] = useState<MidiInputSummary[]>(() => getStore().inputs);
  const [activeNotes, setActiveNotes] = useState<number[]>(() => snapshotNotes());
  const [preferFlats, setPreferFlats] = useState(false);

  const chord = useMemo(() => detectChord(activeNotes, preferFlats), [activeNotes, preferFlats]);

  const onNoteEventRef = useRef(onNoteEvent);
  onNoteEventRef.current = onNoteEvent;

  useEffect(() => {
    if (typeof navigator !== "undefined" && !navigator.requestMIDIAccess) {
      setMidiSupported(false);
    }
  }, []);

  useEffect(() => {
    const store = getStore();
    const listener: Listener = {
      onNotes: setActiveNotes,
      onInputs: setInputs,
      onStatus: setStatus,
      onNoteEvent: (note, on, velocity) => onNoteEventRef.current?.(note, on, velocity)
    };
    store.listeners.add(listener);

    setActiveNotes(snapshotNotes());
    setInputs(store.inputs);
    setStatus(store.status);

    if (store.midiAccess) {
      attachInputListeners();
    }

    // Defensive auto-connect: on the very first user gesture anywhere on the
    // page, try to request MIDI access. If permission was previously granted
    // for this origin, the browser resolves it silently — no dialog, just an
    // instant connection. If it wasn't, the gesture still satisfies the
    // permission-prompt requirement and the dialog appears.
    let attempted = false;
    const autoConnect = () => {
      if (attempted) return;
      attempted = true;
      if (!getStore().midiAccess) {
        connectMidiShared();
      }
      window.removeEventListener("pointerdown", autoConnect);
      window.removeEventListener("keydown", autoConnect);
    };
    window.addEventListener("pointerdown", autoConnect);
    window.addEventListener("keydown", autoConnect);

    return () => {
      store.listeners.delete(listener);
      window.removeEventListener("pointerdown", autoConnect);
      window.removeEventListener("keydown", autoConnect);
    };
  }, []);

  return {
    activeNotes,
    chord,
    connectMidi: connectMidiShared,
    clearNotes: clearNotesShared,
    inputs,
    midiSupported,
    preferFlats,
    setPreferFlats,
    status
  };
}
