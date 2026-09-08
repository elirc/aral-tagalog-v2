import type { CourseTier, Unit } from "./types";

/**
 * Difficulty tracks (CNT). A tier is a run of units at one skill level;
 * `Unit.tier` names the tier it belongs to. Tiers exist so a learner who is
 * not a beginner can be *placed* into a later track rather than replaying
 * material they already know: entering a tier unlocks its first lesson
 * without completing everything before it.
 *
 * Everything here degrades to the flat-course behaviour when a bundle has no
 * tiers (or when units don't name one), so an untiered bundle still works.
 */

/** Units belonging to a tier, in course order. */
export function unitsInTier(units: Unit[], tierId: string): Unit[] {
  return units.filter((u) => u.tier === tierId);
}

/**
 * The tier a lesson sits in, or null when the course is flat / the unit names
 * no tier. Lessons outside every tier fall back to linear unlocking.
 */
export function tierOfLesson(units: Unit[], lessonId: string): string | null {
  for (const unit of units)
    if (unit.lessons.some((l) => l.id === lessonId)) return unit.tier ?? null;
  return null;
}

/** Every lesson id in a tier, in course order. */
export function tierLessonIds(units: Unit[], tierId: string): string[] {
  return unitsInTier(units, tierId).flatMap((u) => u.lessons.map((l) => l.id));
}

export interface TierUnlockContext {
  /** ordered tiers from the bundle; omit for a flat course */
  tiers?: CourseTier[];
  /** tiers the learner explicitly placed into (`tier_started` events) */
  unlockedTierIds?: string[];
}

/**
 * A tier is playable when it is the first one, when the learner placed into
 * it, or when every lesson of the previous tier is done. Unknown tier ids
 * (content skew: a bundle rolled back below a tier the user started) are
 * treated as locked rather than throwing.
 */
export function isTierUnlocked(
  units: Unit[],
  tierId: string,
  completedLessonIds: string[],
  ctx: TierUnlockContext = {},
): boolean {
  const tiers = ctx.tiers ?? [];
  const index = tiers.findIndex((t) => t.id === tierId);
  if (index <= 0) return index === 0; // first tier is always open; unknown = locked
  if ((ctx.unlockedTierIds ?? []).includes(tierId)) return true;
  // Course expansion must not revoke access a learner has already earned.
  const done = new Set(completedLessonIds);
  if (tierLessonIds(units, tierId).some((id) => done.has(id))) return true;
  const prev = tiers[index - 1]!;
  const prevLessons = tierLessonIds(units, prev.id);
  if (prevLessons.length === 0) return true; // an empty tier can't gate the next one
  return prevLessons.every((id) => done.has(id));
}

export interface TierStatus {
  tier: CourseTier;
  unlocked: boolean;
  /** how the tier became playable — drives the course-map label */
  reason: "first" | "placed" | "earned" | "locked";
  lessonsTotal: number;
  lessonsDone: number;
  /** 0..1 */
  fraction: number;
}

/** Per-tier unlock + completion summary for the course map. */
export function tierStatuses(
  units: Unit[],
  completedLessonIds: string[],
  ctx: TierUnlockContext = {},
): TierStatus[] {
  const tiers = ctx.tiers ?? [];
  const done = new Set(completedLessonIds);
  const placed = new Set(ctx.unlockedTierIds ?? []);
  return tiers.map((tier, i) => {
    const lessons = tierLessonIds(units, tier.id);
    const lessonsDone = lessons.filter((id) => done.has(id)).length;
    const unlocked = isTierUnlocked(units, tier.id, completedLessonIds, ctx);
    const reason: TierStatus["reason"] = !unlocked
      ? "locked"
      : i === 0
        ? "first"
        : placed.has(tier.id)
          ? "placed"
          : "earned";
    return {
      tier,
      unlocked,
      reason,
      lessonsTotal: lessons.length,
      lessonsDone,
      fraction: lessons.length === 0 ? 0 : lessonsDone / lessons.length,
    };
  });
}

/**
 * The tier a learner should be offered on the placement screen: the last one
 * they could plausibly skip into. Purely advisory — the UI lets them pick any.
 */
export function suggestedTier(
  units: Unit[],
  completedLessonIds: string[],
  ctx: TierUnlockContext = {},
): CourseTier | null {
  const statuses = tierStatuses(units, completedLessonIds, ctx);
  const open = statuses.filter((s) => s.unlocked && s.fraction < 1);
  return open.length > 0 ? open[open.length - 1]!.tier : (statuses[0]?.tier ?? null);
}
