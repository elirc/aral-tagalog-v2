import { z } from "zod";
import { lessonXp, MAX_COMBO_BONUS_XP, PRACTICE_XP, type ProgressEvent } from "@aral/core";

/**
 * Pure validation/sanitization for the /sync write path, split from the route
 * so tests can exercise every rule without a database or HTTP server.
 */

/**
 * occurred_at is a bigint column read in JS-number mode. A non-integer (or
 * absurd) value passes a bare z.number() but Postgres rejects it on insert —
 * and because /sync inserts the batch in one statement, one malformed event
 * would 500 the whole request. Clients keep a batch that didn't 200, so that
 * single event would wedge the outbox forever: exactly the poison-message
 * failure the per-event `rejected` list exists to prevent.
 */
const timestampSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

/**
 * Ceiling for a single completion: the most any authored lesson can be worth
 * (95) + the perfect bonus (5) + the combo bonus (10). Kept above the real cap
 * computed per lesson below, which is what actually binds.
 */
const MAX_EVENT_XP = 120;

export const eventSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().uuid(),
    type: z.literal("lesson_completed"),
    lessonId: z.string().max(100),
    occurredAt: timestampSchema,
    perfect: z.boolean(),
    xp: z.number().int().min(0).max(MAX_EVENT_XP),
    practice: z.boolean().optional(),
    missedExerciseIds: z.array(z.string().max(100)).max(50).optional(),
    masteredExerciseIds: z.array(z.string().max(100)).max(50).optional(),
    maxCombo: z.number().int().min(0).max(500).optional(),
  }),
  z.object({
    id: z.string().uuid(),
    type: z.literal("hearts_lost"),
    occurredAt: timestampSchema,
    count: z.number().int().min(1).max(20),
  }),
  z.object({
    id: z.string().uuid(),
    type: z.literal("hearts_refilled"),
    occurredAt: timestampSchema,
    amount: z.union([z.number().int().min(1).max(5), z.literal("full")]),
    source: z.enum(["ad", "practice"]),
  }),
  z.object({
    id: z.string().uuid(),
    type: z.literal("goal_set"),
    occurredAt: timestampSchema,
    goalXp: z.number().int().min(10).max(200),
  }),
  z.object({
    id: z.string().uuid(),
    type: z.literal("tier_started"),
    occurredAt: timestampSchema,
    tierId: z.string().min(1).max(60),
  }),
]);

/** Minimal compiler-produced data needed to validate completion events. */
export interface CatalogLesson {
  id: string;
  xp: number;
  exerciseCount: number;
}

/** Authored lesson catalog; null when compiled content is unavailable. */
export interface LessonCatalog {
  lessonById: Map<string, CatalogLesson>;
  /** highest lessonXp(l, perfect=true) across the catalog */
  maxAuthoredXp: number;
}

export interface SanitizedBatch {
  events: ProgressEvent[];
  /** ids of events that failed validation (only those carrying a string id) */
  rejected: string[];
}

/**
 * Validate a raw event batch and clamp what clients could lie about:
 * - xp on practice replays is always PRACTICE_XP at most (farming guard)
 * - xp on first-time completions is capped at the authored value plus the
 *   combo bonus ceiling; unknown lesson ids (bundle version skew) get the
 *   catalog max rather than a rejection so a newer client's progress isn't lost
 * - maxCombo can't exceed the lesson's exercise count — a session cannot
 *   answer more questions than it contains, and combo quests pay XP
 * - future occurredAt timestamps are clamped to `now` (OFF-05)
 * Invalid events are reported in `rejected`, never inserted.
 */
export function sanitizeEvents(raw: unknown[], catalog: LessonCatalog | null, now: number): SanitizedBatch {
  const events: ProgressEvent[] = [];
  const rejected: string[] = [];
  for (const item of raw) {
    const parsed = eventSchema.safeParse(item);
    if (!parsed.success) {
      const id = (item as { id?: unknown } | null)?.id;
      // echo the id so the client can correlate, but never reflect an
      // arbitrarily long attacker-controlled string back in the response
      if (typeof id === "string" && id.length <= 100) rejected.push(id);
      continue;
    }
    const ev = parsed.data;
    if (ev.type === "lesson_completed") {
      const lesson = catalog?.lessonById.get(ev.lessonId);
      if (ev.practice) {
        ev.xp = Math.min(ev.xp, PRACTICE_XP);
      } else if (catalog) {
        const cap = lesson
          ? lessonXp(lesson, ev.perfect) + MAX_COMBO_BONUS_XP
          : catalog.maxAuthoredXp + MAX_COMBO_BONUS_XP;
        ev.xp = Math.min(ev.xp, cap);
      }
      // combo quests pay out on this number, so bound it by what the lesson
      // could physically produce (unknown lessons keep the schema's cap)
      if (ev.maxCombo !== undefined && lesson)
        ev.maxCombo = Math.min(ev.maxCombo, lesson.exerciseCount);
    }
    events.push({ ...ev, occurredAt: Math.min(ev.occurredAt, now) } as ProgressEvent);
  }
  return { events, rejected };
}
