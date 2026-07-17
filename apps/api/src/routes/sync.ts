import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { progressEvents } from "@aral/db";
import { lessonXp, type CourseBundle, type Lesson, type ProgressEvent } from "@aral/core";
import { requireAuth } from "../auth";
import { env } from "../env";
import { getUser, getUserProgress } from "../progress";

// Authored lesson catalog, so xp is validated against *meaning*, not just
// shape — otherwise any client can farm XP with invented lesson_completed
// events. Missing bundle (content not built yet) falls back to shape-only.
const lessonById = new Map<string, Lesson>();
let maxAuthoredXp = 100;
try {
  const bundle = JSON.parse(
    readFileSync(join(env.contentDir, "course_en_tl.json"), "utf8"),
  ) as CourseBundle;
  for (const u of bundle.units) for (const l of u.lessons) lessonById.set(l.id, l);
  maxAuthoredXp = Math.max(...[...lessonById.values()].map((l) => lessonXp(l, true)));
} catch {
  // dev before `pnpm content:build` — shape validation still applies
}

const eventSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().uuid(),
    type: z.literal("lesson_completed"),
    lessonId: z.string().max(100),
    occurredAt: z.number(),
    perfect: z.boolean(),
    xp: z.number().int().min(0).max(100),
    practice: z.boolean().optional(),
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

const syncSchema = z.object({ events: z.array(z.unknown()).max(500) });

/**
 * The single write path for progress (API-01). Idempotent: events keyed by
 * client-generated UUID; replays are ignored. Responds with server-derived
 * progress so the client can reconcile.
 *
 * Events are validated individually: valid ones are inserted, invalid ones
 * are reported back in `rejected`. Rejecting the whole batch would let one
 * malformed event permanently wedge a client outbox that retries the same
 * batch forever (poison message) — a 200 means every sent event is resolved,
 * so clients can drop the batch from their outbox either way.
 */
export function syncRoutes(app: FastifyInstance) {
  app.post("/sync", { preHandler: requireAuth }, async (req, reply) => {
    const body = syncSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid body" });

    const now = Date.now();
    const events: ProgressEvent[] = [];
    const rejected: string[] = [];
    for (const raw of body.data.events) {
      const parsed = eventSchema.safeParse(raw);
      if (parsed.success) {
        if (parsed.data.type === "lesson_completed" && lessonById.size > 0) {
          // clamp client-asserted xp to the authored value; unknown lesson ids
          // (bundle version skew between client and server) get the catalog max
          // rather than a rejection, so a newer client's progress isn't lost
          const lesson = lessonById.get(parsed.data.lessonId);
          const cap = lesson ? lessonXp(lesson, parsed.data.perfect) : maxAuthoredXp;
          parsed.data.xp = Math.min(parsed.data.xp, cap);
        }
        events.push(parsed.data as ProgressEvent);
      } else {
        const id = (raw as { id?: unknown } | null)?.id;
        if (typeof id === "string") rejected.push(id);
      }
    }
    if (events.length > 0) {
      await app.db
        .insert(progressEvents)
        .values(
          events.map((ev) => ({
            id: ev.id,
            userId: req.userId,
            type: ev.type,
            // clamp future timestamps on write too (OFF-05)
            payload: { ...ev, occurredAt: Math.min(ev.occurredAt, now) },
            occurredAt: Math.min(ev.occurredAt, now),
          })),
        )
        .onConflictDoNothing();
    }

    const user = await getUser(app.db, req.userId);
    if (!user) return reply.code(401).send({ error: "user gone" });
    return { accepted: events.length, rejected, progress: await getUserProgress(app.db, req.userId, user.tz) };
  });
}
