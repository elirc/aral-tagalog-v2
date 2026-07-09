import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { refreshTokens, users } from "@aral/db";
import { hashPassword, hashToken, newRefreshToken, signAccessToken, verifyPassword } from "../auth";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  tz: z.string().max(64).optional(),
  displayName: z.string().max(80).optional(),
});

export function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (req, reply) => {
    const body = credentialsSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? "invalid body" });
    const { email, password, tz, displayName } = body.data;

    const existing = await app.db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase()));
    if (existing.length > 0) return reply.code(409).send({ error: "email already registered" });

    const [user] = await app.db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash: await hashPassword(password),
        tz: tz ?? "UTC",
        displayName,
      })
      .returning();
    return reply.code(201).send(await issueTokens(app, user!.id, user!));
  });

  app.post("/auth/login", async (req, reply) => {
    const body = credentialsSchema.pick({ email: true, password: true }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid body" });

    const [user] = await app.db.select().from(users).where(eq(users.email, body.data.email.toLowerCase()));
    if (!user || !(await verifyPassword(user.passwordHash, body.data.password)))
      return reply.code(401).send({ error: "invalid email or password" });
    return issueTokens(app, user.id, user);
  });

  app.post("/auth/refresh", async (req, reply) => {
    const body = z.object({ refreshToken: z.string() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid body" });

    const tokenHash = hashToken(body.data.refreshToken);
    const [row] = await app.db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
    if (!row || row.expiresAt.getTime() < Date.now())
      return reply.code(401).send({ error: "invalid refresh token" });

    // rotate: old token is single-use
    await app.db.delete(refreshTokens).where(eq(refreshTokens.id, row.id));
    const [user] = await app.db.select().from(users).where(eq(users.id, row.userId));
    if (!user) return reply.code(401).send({ error: "user gone" });
    return issueTokens(app, user.id, user);
  });
}

async function issueTokens(
  app: FastifyInstance,
  userId: string,
  user: { email: string; tz: string; displayName: string | null },
) {
  const refresh = newRefreshToken();
  await app.db.insert(refreshTokens).values({ userId, tokenHash: refresh.tokenHash, expiresAt: refresh.expiresAt });
  return {
    accessToken: await signAccessToken(userId),
    refreshToken: refresh.token,
    user: { id: userId, email: user.email, tz: user.tz, displayName: user.displayName },
  };
}
