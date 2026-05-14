# Chords

A browser app for practicing chord recognition and sight‑reading on a real MIDI keyboard. Plug in a controller, open the page, play.

Built with Next.js 15, React 19 (with the React Compiler), and the Web MIDI API.

## Modes

### Chord Runner — `/`
A runner game where each obstacle is a named chord. Play the correct notes on your MIDI keyboard to clear it. Levels ramp up through chord families:

1. Basic triads (major / minor)
2. 7ths (maj7, 7, m7)
3. Sus & add9
4. Augmented & diminished
5. 9ths (9, m9)
6. Endurance — every shape mixed

### Play — `/play`
A falling‑tiles song player. Pick a song, hit each tile as it crosses the line. Adjustable playback speed (0.4× – 1.5×) and an optional "Listen" mode that plays the song for you.

Songs live in [public/songs/](public/songs/) as standard `.mid` files and are registered in [lib/play/songs.ts](lib/play/songs.ts).

### Sounds — `/sounds`
Pick the voice used for note playback: a built‑in detuned‑saw synth, or any of several sampled instruments (Splendid Grand Piano, Rhodes, strings, harp, organ, vibes, celesta, …) loaded via [smplr](https://github.com/danigb/smplr). An optional background strings pad sits underneath everything.

## Requirements

- A MIDI keyboard connected over USB (or Bluetooth MIDI).
- A browser with [Web MIDI](https://developer.mozilla.org/docs/Web/API/Web_MIDI_API) support — Chrome, Edge, or Opera on desktop. Safari and Firefox don't currently expose Web MIDI.
- Desktop only. Mobile is blocked by [components/layout/mobile-block.tsx](components/layout/mobile-block.tsx).

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 and click the MIDI button in the top bar to grant access.

## Scripts

- `npm run dev` — Next dev server
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — Next lint

## Project layout

```
app/                  Next.js routes (/, /play, /sounds)
components/
  game/               Chord Runner UI
  play/               Falling‑tiles player
  sounds/             Voice picker
  layout/             Top bar, mobile block, hero
  audio/              Background pad host
  intro/              Splash intro
hooks/
  use-midi-input.ts   Web MIDI subscription + chord detection
  use-midi-synth.ts   Voice playback (synth or smplr instrument)
  use-chord-runner.ts Runner game state machine
  use-tile-game.ts    Falling‑tiles game loop
lib/
  music/              Chord detection, qualities, note names
  game/               Prompt sequences, runner engine
  play/               MIDI file loader, song registry, piano geometry
  audio/              Voice source + background pad
public/songs/         .mid files served to the Play page
types/                Shared types incl. WebMIDI declarations
```

## Adding a song

1. Drop the `.mid` file into [public/songs/](public/songs/).
2. Add an entry to `SONG_FILES` in [lib/play/songs.ts](lib/play/songs.ts) with a stable `id`, display `title`, and the `url` under `/songs/`.

The file is fetched, parsed with `@tonejs/midi`, and cached for the tab's lifetime.

## Adding a chord prompt

Edit one of the prompt pools in [lib/game/chord-prompts.ts](lib/game/chord-prompts.ts) (`TRIADS`, `SEVENTHS`, `SUS_ADD9`, `AUG_DIM`, `EXTENSIONS`). Each entry is a `root` pitch class, a `quality` label, and the exact MIDI `notes` the player must hold to clear it.
