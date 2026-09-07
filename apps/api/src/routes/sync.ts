import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { progressEvents } from "@aral/db";
import { requireAuth } from "../auth";
import { catalog } from "../catalog";
import { getUser, getUserProgress } from "../progress";
import { sanitizeEvents } from "../sync-validation";

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

    const user = await getUser(app.db, req.userId);
    if (!user) return reply.code(401).send({ error: "user gone" });

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

    return { accepted: events.length, rejected, progress: await getUserProgress(app.db, req.userId, user.tz) };
  });
}
