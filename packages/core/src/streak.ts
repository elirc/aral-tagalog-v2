/**
 * Streaks roll over at local midnight in the user's IANA timezone (GAM-02).
 * Days are compared as "YYYY-MM-DD" keys computed in that timezone.
 */
export interface StreakState {
  count: number;
  /** local day key of the last counted completion, e.g. "2026-07-09" */
  lastDay: string | null;
}

export const emptyStreak: StreakState = { count: 0, lastDay: null };

/** Local calendar day for a timestamp in an IANA timezone. */
export function localDayKey(timestampMs: number, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestampMs));
}

function dayNumber(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, d!) / 86_400_000);
}

/** Update the streak for a lesson completed on `dayKey` (device-local day). */
export function applyCompletionDay(s: StreakState, dayKey: string): StreakState {
  if (s.lastDay === null) return { count: 1, lastDay: dayKey };
  const diff = dayNumber(dayKey) - dayNumber(s.lastDay);
  if (diff <= 0) return s; // same day (or out-of-order sync) — already counted
  if (diff === 1) return { count: s.count + 1, lastDay: dayKey };
  return { count: 1, lastDay: dayKey }; // gap — streak resets
}

/** A streak is shown as alive if the last counted day is today or yesterday. */
export function isStreakAlive(s: StreakState, todayKey: string): boolean {
  if (s.lastDay === null) return false;
  return dayNumber(todayKey) - dayNumber(s.lastDay) <= 1;
}

/** Streak count to display right now (0 once a day has been missed). */
export function displayStreak(s: StreakState, todayKey: string): number {
  return isStreakAlive(s, todayKey) ? s.count : 0;
}
