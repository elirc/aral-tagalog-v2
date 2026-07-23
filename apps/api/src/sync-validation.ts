import { z } from "zod";
import { lessonXp, PRACTICE_XP, type Lesson, type ProgressEvent } from "@aral/core";

/**
 * Pure validation/sanitization for the /sync write path, split from the route
 * so tests can exercise every rule without a database or HTTP server.
 */

export const eventSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().uuid(),
    type: z.literal("lesson_completed"),
    lessonId: z.string().max(100),
    occurredAt: z.number(),
    perfect: z.boolean(),
    xp: z.number().int().min(0).max(100),
    practice: z.boolean().optional(),
    missedExerciseIds: z.array(z.string().max(100)).max(50).optional(),
    masteredExerciseIds: z.array(z.string().max(100)).max(50).optional(),
  }),
  z.object({
    id: z.string().uuid(),
    type: z.literal("hearts_lost"),
    occurredAt: z.number(),
    count: z.number().int().min(1).max(20),
  }),
  z.object({
    id: z.string().uuid(),
    type: z.literal("hearts_refilled"),
    occurredAt: z.number(),
    amount: z.union([z.number().int().min(1).max(5), z.literal("full")]),
    source: z.enum(["ad", "practice"]),
  }),
  z.object({
    id: z.string().uuid(),
    type: z.literal("goal_set"),
    occurredAt: z.number(),
    goalXp: z.number().int().min(10).max(200),
  }),
]);

/** Authored lesson catalog; null when the content bundle isn't available. */
export interface LessonCatalog {
  lessonById: Map<string, Lesson>;
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
 * - xp on first-time completions is capped at the authored value; unknown
 *   lesson ids (bundle version skew) get the catalog max rather than a
 *   rejection so a newer client's progress isn't lost
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
      if (ev.practice) {
        ev.xp = Math.min(ev.xp, PRACTICE_XP);
      } else if (catalog) {
        const lesson = catalog.lessonById.get(ev.lessonId);
        const cap = lesson ? lessonXp(lesson, ev.perfect) : catalog.maxAuthoredXp;
        ev.xp = Math.min(ev.xp, cap);
      }
    }
    events.push({ ...ev, occurredAt: Math.min(ev.occurredAt, now) } as ProgressEvent);
  }
  return { events, rejected };
}
