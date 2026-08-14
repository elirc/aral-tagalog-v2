import type { UserProgress } from "./events";

/**
 * Achievements are *derived*, not stored: they add no new events and no new
 * UserProgress fields. Given a folded UserProgress (and optionally the course
 * structure, for unit-completion), earnedAchievementIds re-computes which
 * badges are unlocked. Definitions are pure data; the unlock criteria live in
 * an internal predicate map keyed by the same ids, so every ACHIEVEMENTS entry
 * has exactly one rule and results come back in definition order.
 */
export interface AchievementDef {
  id: string;
  /** playful, Tagalog-flavored title */
  title: string;
  description: string;
  emoji: string;
  /** 1 = easy / early, 2 = mid, 3 = hard / long-haul */
  tier: 1 | 2 | 3;
}

export interface AchievementCourseUnit {
  id: string;
  lessons: { id: string }[];
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // Tier 1 — early wins
  { id: "first_lesson", title: "Simula!", description: "Complete your first lesson.", emoji: "🌱", tier: 1 },
  { id: "first_perfect", title: "Walang Mali!", description: "Finish a lesson with a perfect score.", emoji: "✨", tier: 1 },
  { id: "first_practice", title: "Ulitin!", description: "Replay a lesson to practice.", emoji: "🔁", tier: 1 },
  { id: "streak_3", title: "Tatlong Araw", description: "Reach a 3-day streak.", emoji: "🔥", tier: 1 },
  { id: "xp_100", title: "Sandaang XP", description: "Earn 100 XP.", emoji: "⭐", tier: 1 },
  // Tier 2 — momentum
  { id: "lessons_10", title: "Magaling!", description: "Complete 10 lessons.", emoji: "📚", tier: 2 },
  { id: "perfects_10", title: "Perpekto", description: "Finish 10 perfect lessons.", emoji: "💎", tier: 2 },
  { id: "streak_7", title: "Isang Linggo", description: "Reach a 7-day streak.", emoji: "🗓️", tier: 2 },
  { id: "xp_500", title: "Limang Daang XP", description: "Earn 500 XP.", emoji: "🌟", tier: 2 },
  { id: "unit_complete", title: "Yugto Tapos", description: "Complete every lesson in a unit.", emoji: "🏅", tier: 2 },
  { id: "mistakes_cleared_10", title: "Ayos!", description: "Clear 10 mistakes in review.", emoji: "🧹", tier: 2 },
  // Tier 3 — long haul
  { id: "lessons_50", title: "Bihasa", description: "Complete 50 lessons.", emoji: "🎓", tier: 3 },
  { id: "streak_30", title: "Isang Buwan", description: "Reach a 30-day streak.", emoji: "🏆", tier: 3 },
  { id: "xp_2000", title: "Dalubhasa", description: "Earn 2000 XP.", emoji: "👑", tier: 3 },
  // Tier 3 — end-game, sized for the full 200-lesson course. Without these a
  // learner unlocks every badge about a quarter of the way in.
  { id: "lessons_150", title: "Matiyaga", description: "Complete 150 lessons.", emoji: "🧗", tier: 3 },
  { id: "streak_100", title: "Sandaang Araw", description: "Reach a 100-day streak.", emoji: "☄️", tier: 3 },
  { id: "course_complete", title: "Tagumpay!", description: "Complete every lesson in the course.", emoji: "🇵🇭", tier: 3 },
];

/** Did the user fully complete at least one unit (all its lessons)? */
function anyUnitCompleted(progress: UserProgress, courseUnits?: AchievementCourseUnit[]): boolean {
  if (!courseUnits || courseUnits.length === 0) return false;
  const done = new Set(progress.completedLessonIds ?? []);
  return courseUnits.some(
    (u) => u.lessons.length > 0 && u.lessons.every((l) => done.has(l.id)),
  );
}

/** Every lesson of every unit — the course-completion badge. */
function allUnitsCompleted(progress: UserProgress, courseUnits?: AchievementCourseUnit[]): boolean {
  if (!courseUnits || courseUnits.length === 0) return false;
  const done = new Set(progress.completedLessonIds ?? []);
  // an empty unit can't gate completion, but the course must have real lessons
  const lessons = courseUnits.flatMap((u) => u.lessons);
  return lessons.length > 0 && lessons.every((l) => done.has(l.id));
}

type Criterion = (p: UserProgress, units?: AchievementCourseUnit[]) => boolean;

const CRITERIA: Record<string, Criterion> = {
  first_lesson: (p) => (p.lessonsCompleted ?? 0) >= 1,
  first_perfect: (p) => (p.perfectLessons ?? 0) >= 1,
  first_practice: (p) => (p.practiceCount ?? 0) >= 1,
  streak_3: (p) => (p.longestStreak ?? p.streak?.count ?? 0) >= 3,
  xp_100: (p) => (p.xpTotal ?? 0) >= 100,
  lessons_10: (p) => (p.lessonsCompleted ?? 0) >= 10,
  perfects_10: (p) => (p.perfectLessons ?? 0) >= 10,
  streak_7: (p) => (p.longestStreak ?? p.streak?.count ?? 0) >= 7,
  xp_500: (p) => (p.xpTotal ?? 0) >= 500,
  unit_complete: (p, units) => anyUnitCompleted(p, units),
  mistakes_cleared_10: (p) => (p.mistakesCleared ?? 0) >= 10,
  lessons_50: (p) => (p.lessonsCompleted ?? 0) >= 50,
  streak_30: (p) => (p.longestStreak ?? p.streak?.count ?? 0) >= 30,
  xp_2000: (p) => (p.xpTotal ?? 0) >= 2000,
  lessons_150: (p) => (p.lessonsCompleted ?? 0) >= 150,
  streak_100: (p) => (p.longestStreak ?? p.streak?.count ?? 0) >= 100,
  course_complete: (p, units) => allUnitsCompleted(p, units),
};

/**
 * The ids of every achievement the user has earned, in ACHIEVEMENTS order.
 * `courseUnits` is only needed for unit-completion achievements; omit it and
 * those simply stay locked.
 */
export function earnedAchievementIds(
  progress: UserProgress,
  courseUnits?: AchievementCourseUnit[],
): string[] {
  return ACHIEVEMENTS.filter((a) => CRITERIA[a.id]?.(progress, courseUnits) ?? false).map(
    (a) => a.id,
  );
}
