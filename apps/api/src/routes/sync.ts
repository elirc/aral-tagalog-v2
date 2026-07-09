import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { progressEvents } from "@aral/db";
import type { ProgressEvent } from "@aral/core";
import { requireAuth } from "../auth";
import { getUser, getUserProgress } from "../progress";

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
]);

const syncSchema = z.object({ events: z.array(eventSchema).max(500) });

/**
 * The single write path for progress (API-01). Idempotent: events keyed by
 * client-generated UUID; replays are ignored. Responds with server-derived
 * progress so the client can reconcile.
 */
export function syncRoutes(app: FastifyInstance) {
  app.post("/sync", { preHandler: requireAuth }, async (req, reply) => {
    const body = syncSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? "invalid body" });

    const now = Date.now();
    const events = body.data.events as ProgressEvent[];
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
    return { accepted: events.length, progress: await getUserProgress(app.db, req.userId, user.tz) };
  });
}
