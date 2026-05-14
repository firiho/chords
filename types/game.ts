export type PromptAccent = "lime" | "orange" | "sky";

export type ObstaclePrompt = {
  id: string;
  root: number; // pitch class 0-11
  quality: string; // chord-quality suffix ("", "m", "7", "maj7", "sus4", "aug", "dim", "9", "m9", ...)
  pitchClasses: number[];
  notes: number[];
  accent: PromptAccent;
};

export type GamePhase = "idle" | "running" | "level-up" | "game-over";

export type Bullet = {
  id: string;
  prompt: ObstaclePrompt;
  progress: number; // 100 = far right, 0 = far left
  speed: number; // progress units per second
};

export type GameSnapshot = {
  phase: GamePhase;
  score: number;
  streak: number;
  level: number;
  bullets: Bullet[];
  holdProgress: number;
  jumpProgress: number;
  clearPulseId: number;
  crashPulseId: number;
  statusText: string;
  prompt: ObstaclePrompt; // closest bullet's prompt, or idle placeholder
};
