export const GAME_CONSTANTS = {
  startProgress: 100,
  matchWindow: 80,
  playerPosition: 14, // % from left — must match PLAYER_LEFT_PCT in game-stage
  baseDrainPerSecond: 11,
  holdTimeRequired: 0.06,
  jumpDurationSec: 0.6,
  clearsPerLevel: 10
};

export function drainRateForLevel(level: number) {
  return GAME_CONSTANTS.baseDrainPerSecond + (level - 1) * 1.8;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
