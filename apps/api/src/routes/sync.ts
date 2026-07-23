import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { progressEvents } from "@aral/db";
import { lessonXp, type CourseBundle, type Lesson } from "@aral/core";
import { requireAuth } from "../auth";
import { env } from "../env";
import { getUser, getUserProgress } from "../progress";
import { sanitizeEvents, type LessonCatalog } from "../sync-validation";

// Authored lesson catalog, so xp is validated against *meaning*, not just
// shape — otherwise any client can farm XP with invented lesson_completed
// events. Missing bundle (content not built yet) falls back to shape-only.
let catalog: LessonCatalog | null = null;
try {
  const bundle = JSON.parse(
    readFileSync(join(env.contentDir, "course_en_tl.json"), "utf8"),
  ) as CourseBundle;
  const lessonById = new Map<string, Lesson>();
  for (const u of bundle.units) for (const l of u.lessons) lessonById.set(l.id, l);
  catalog = {
    lessonById,
    maxAuthoredXp: Math.max(...[...lessonById.values()].map((l) => lessonXp(l, true))),
  };
} catch {
  // dev before `pnpm content:build` — shape validation still applies, but the
  // xp clamp is off, so make the degraded mode impossible to miss in a deploy
  console.warn(
    `⚠ /sync: no compiled bundle at ${env.contentDir} — lesson XP will not be clamped to authored values`,
  );
}

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

    const { events, rejected } = sanitizeEvents(body.data.events, catalog, Date.now());
    if (events.length > 0) {
      await app.db
        .insert(progressEvents)
        .values(
          events.map((ev) => ({
            id: ev.id,
            userId: req.userId,
            type: ev.type,
            payload: ev, // occurredAt already clamped by sanitizeEvents (OFF-05)
            occurredAt: ev.occurredAt,
          })),
        )
        .onConflictDoNothing();
    }

    const user = await getUser(app.db, req.userId);
    if (!user) return reply.code(401).send({ error: "user gone" });
    return { accepted: events.length, rejected, progress: await getUserProgress(app.db, req.userId, user.tz) };
  });
}
