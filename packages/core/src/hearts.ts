export const MAX_HEARTS = 5;
export const HEART_REGEN_MS = 4 * 60 * 60 * 1000; // 1 heart per 4 hours

/**
 * Hearts are computed from (count at a timestamp) + elapsed time, so they
 * work offline with no server clock (OFF-05). Timestamps are epoch ms.
 */
export interface HeartsState {
  hearts: number;
  updatedAt: number;
}

export function fullHearts(now: number): HeartsState {
  return { hearts: MAX_HEARTS, updatedAt: now };
}

/** Apply regeneration up to `now`. Always call before reading or mutating. */
export function regenerate(s: HeartsState, now: number): HeartsState {
  if (s.hearts >= MAX_HEARTS || now <= s.updatedAt) return s;
  const gained = Math.floor((now - s.updatedAt) / HEART_REGEN_MS);
  if (gained <= 0) return s;
  const hearts = Math.min(MAX_HEARTS, s.hearts + gained);
  return {
    hearts,
    updatedAt: hearts >= MAX_HEARTS ? now : s.updatedAt + gained * HEART_REGEN_MS,
  };
}

export function loseHeart(s: HeartsState, now: number): HeartsState {
  const cur = regenerate(s, now);
  if (cur.hearts <= 0) return cur;
  // starting to regen from full begins now
  const updatedAt = cur.hearts >= MAX_HEARTS ? now : cur.updatedAt;
  return { hearts: cur.hearts - 1, updatedAt };
}

export function addHearts(s: HeartsState, amount: number | "full", now: number): HeartsState {
  const cur = regenerate(s, now);
  if (amount === "full") return fullHearts(now);
  const hearts = Math.min(MAX_HEARTS, cur.hearts + amount);
  return { hearts, updatedAt: hearts >= MAX_HEARTS ? now : cur.updatedAt };
}

/** ms until the next heart appears, or null if full or empty-regen edge cases don't apply */
export function msUntilNextHeart(s: HeartsState, now: number): number | null {
  const cur = regenerate(s, now);
  if (cur.hearts >= MAX_HEARTS) return null;
  return Math.max(0, cur.updatedAt + HEART_REGEN_MS - now);
}
