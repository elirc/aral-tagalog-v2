import type { LessonOverview, UnitOverview, VocabEntry } from "./types";
import { isLessonUnlocked } from "./review";
import { suggestedTier, type TierUnlockContext } from "./tiers";

export interface NextLesson {
  unit: UnitOverview;
  lesson: LessonOverview;
  unitIndex: number;
}

/** Find one candidate per track, avoiding a full unlock scan for every lesson. */
export function findNextLesson(
  units: UnitOverview[],
  completed: string[],
  context: TierUnlockContext = {},
  preferredTierId?: string,
): NextLesson | null {
  const done = new Set(completed);
  const candidates = new Map<string, NextLesson>();
  for (const [unitIndex, unit] of units.entries()) {
    const key = unit.tier ?? "";
    if (candidates.has(key)) continue;
    const lesson = unit.lessons.find((entry) => !done.has(entry.id));
    if (lesson) candidates.set(key, { unit, lesson, unitIndex });
  }
  const preferred = preferredTierId ?? suggestedTier(units, completed, context)?.id;
  const first = preferred ? candidates.get(preferred) : undefined;
  const ordered = first ? [first, ...candidates.values()] : [...candidates.values()];
  return ordered.find(({ lesson }) => isLessonUnlocked(units, lesson.id, completed, context)) ?? null;
}

/** Search is forgiving about accents and punctuation; answer grading stays separate. */
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function matchesSearch(query: string, ...fields: Array<string | undefined>): boolean {
  const terms = normalizeSearch(query).split(" ").filter(Boolean);
  const text = normalizeSearch(fields.filter(Boolean).join(" "));
  return terms.every((term) => text.includes(term));
}

export function searchVocab(entries: VocabEntry[], query: string): VocabEntry[] {
  return entries.filter((entry) => matchesSearch(query, entry.lemma, entry.translation, entry.notes));
}

/** Course-map availability in one pass, rather than a whole-course scan per row. */
export function playableLessonIds(
  units: UnitOverview[], completed: string[], context: TierUnlockContext = {},
): Set<string> {
  const available = new Set(completed);
  const candidates = new Map<string, string>();
  for (const unit of units) {
    const tier = unit.tier ?? "";
    if (candidates.has(tier)) continue;
    const lesson = unit.lessons.find((entry) => !available.has(entry.id));
    if (lesson) candidates.set(tier, lesson.id);
  }
  for (const id of candidates.values()) {
    if (isLessonUnlocked(units, id, completed, context)) available.add(id);
  }
  return available;
}
