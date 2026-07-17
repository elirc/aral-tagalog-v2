/**
 * XP → level curve (GAM). Level 1 starts at 0 XP. The cumulative XP required to
 * *reach* level n is a rising quadratic so early levels come fast and later
 * levels stretch out:
 *
 *   threshold(n) = 50 * (n - 1) * n / 2 = 25 * n * (n - 1)
 *
 *   level 1 → 0 XP, level 2 → 50, level 3 → 150, level 4 → 300, level 5 → 500 …
 *
 * The per-level cost (threshold(n+1) − threshold(n) = 50 * n) grows linearly.
 */

/** Cumulative XP required to reach `level` (level 1 = 0). */
export function xpThresholdForLevel(level: number): number {
  if (level <= 1) return 0;
  return 25 * level * (level - 1);
}

/** The level a user is at for a given total XP (never below 1). */
export function levelForXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 1; // NaN / ±Infinity / negative / zero → level 1
  // Clamp so the drift-correction loops below always terminate: a corrupt
  // baseline (e.g. localStorage edited to 1e400 → Infinity) must not hang.
  const x = Math.min(xp, Number.MAX_SAFE_INTEGER);
  // Invert threshold(n) = 25n² − 25n; solve 25n² − 25n − x = 0.
  let n = Math.floor((25 + Math.sqrt(625 + 100 * x)) / 50);
  if (n < 1) n = 1;
  // Correct any floating-point drift at boundaries.
  while (xpThresholdForLevel(n + 1) <= x) n++;
  while (n > 1 && xpThresholdForLevel(n) > x) n--;
  return n;
}

export interface LevelProgress {
  level: number;
  /** XP earned inside the current level (0 at the moment of level-up) */
  xpIntoLevel: number;
  /** XP span from this level to the next (how much a full level costs) */
  xpForNextLevel: number;
}

/** Level plus progress toward the next level for a total XP amount. */
export function levelProgress(xp: number): LevelProgress {
  const safeXp = Number.isFinite(xp) && xp > 0 ? Math.min(xp, Number.MAX_SAFE_INTEGER) : 0;
  const level = levelForXp(safeXp);
  const base = xpThresholdForLevel(level);
  const next = xpThresholdForLevel(level + 1);
  return {
    level,
    xpIntoLevel: safeXp - base,
    xpForNextLevel: next - base,
  };
}
