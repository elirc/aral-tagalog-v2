import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { users } from "@aral/db";
import { requireAuth } from "../auth";
import { getUser, getUserProgress } from "../progress";

export function meRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: requireAuth }, async (req, reply) => {
    const user = await getUser(app.db, req.userId);
    if (!user) return reply.code(404).send({ error: "user not found" });
    return {
      user: { id: user.id, email: user.email, tz: user.tz, displayName: user.displayName },
      progress: await getUserProgress(app.db, req.userId, user.tz),
    };
  });

  // profile settings are last-writer-wins (OFF-03)
  app.patch("/me", { preHandler: requireAuth }, async (req, reply) => {
    const body = z
      .object({ tz: z.string().max(64).optional(), displayName: z.string().max(80).nullable().optional() })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid body" });
    const [user] = await app.db.update(users).set(body.data).where(eq(users.id, req.userId)).returning();
    if (!user) return reply.code(404).send({ error: "user not found" });
    return { user: { id: user.id, email: user.email, tz: user.tz, displayName: user.displayName } };
  });
}
