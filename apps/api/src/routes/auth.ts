import type { FastifyInstance } from "fastify";
import { and, eq, isNull, lt } from "drizzle-orm";
import { z } from "zod";
import { refreshTokens, users } from "@aral/db";
import { isValidTimeZone } from "@aral/core";
import { hashPassword, hashToken, newRefreshToken, signAccessToken, verifyPassword } from "../auth";

// tz is stored and later fed to Intl by every progress derivation — an
// unvalidated zone would 500 that user's /me and /sync forever
export const tzSchema = z.string().max(64).refine(isValidTimeZone, "unknown IANA timezone");

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  tz: tzSchema.optional(),
  displayName: z.string().max(80).optional(),
});

// tighter than the global limit: these routes run argon2 per request
const authRateLimit = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

export function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", authRateLimit, async (req, reply) => {
    const body = credentialsSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? "invalid body" });
    const { email, password, tz, displayName } = body.data;

    const existing = await app.db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase()));
    if (existing.length > 0) return reply.code(409).send({ error: "email already registered" });

    let user;
    try {
      [user] = await app.db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          passwordHash: await hashPassword(password),
          tz: tz ?? "UTC",
          displayName,
        })
        .returning();
    } catch (err) {
      // concurrent duplicate registration: both pass the SELECT, the loser
      // hits the unique constraint — that's still "already registered"
      const e = err as { code?: string; cause?: { code?: string } };
      if (e.code === "23505" || e.cause?.code === "23505")
        return reply.code(409).send({ error: "email already registered" });
      throw err;
    }
    return reply.code(201).send(await issueTokens(app, user!.id, user!));
  });

  app.post("/auth/login", authRateLimit, async (req, reply) => {
    const body = credentialsSchema.pick({ email: true, password: true }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid body" });

    const [user] = await app.db.select().from(users).where(eq(users.email, body.data.email.toLowerCase()));
    if (!user || !(await verifyPassword(user.passwordHash, body.data.password)))
      return reply.code(401).send({ error: "invalid email or password" });
    return issueTokens(app, user.id, user);
  });

  app.post("/auth/refresh", authRateLimit, async (req, reply) => {
    const body = z.object({ refreshToken: z.string() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid body" });

    const tokenHash = hashToken(body.data.refreshToken);
    const [row] = await app.db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
    if (!row || row.expiresAt.getTime() < Date.now())
      return reply.code(401).send({ error: "invalid refresh token" });

    // Reuse detection: a rotated token is kept as a tombstone. Someone
    // presenting it again holds a leaked (or stale-stolen) token — revoke the
    // whole family so the thief's fresh token dies too.
    if (row.rotatedAt) {
      await app.db.delete(refreshTokens).where(eq(refreshTokens.familyId, row.familyId));
      return reply.code(401).send({ error: "refresh token reused" });
    }

    // Atomic claim: of two concurrent refreshes with the same token, exactly
    // one wins this UPDATE; the loser is treated as reuse.
    const claimed = await app.db
      .update(refreshTokens)
      .set({ rotatedAt: new Date() })
      .where(and(eq(refreshTokens.id, row.id), isNull(refreshTokens.rotatedAt)))
      .returning({ id: refreshTokens.id });
    if (claimed.length === 0) {
      await app.db.delete(refreshTokens).where(eq(refreshTokens.familyId, row.familyId));
      return reply.code(401).send({ error: "refresh token reused" });
    }

    const [user] = await app.db.select().from(users).where(eq(users.id, row.userId));
    if (!user) return reply.code(401).send({ error: "user gone" });
    return issueTokens(app, user.id, user, row.familyId);
  });

  // Possession of the refresh token is the credential here — no Bearer needed,
  // so a client whose access token already expired can still log out cleanly.
  app.post("/auth/logout", authRateLimit, async (req, reply) => {
    const body = z.object({ refreshToken: z.string() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid body" });
    const [row] = await app.db
      .select({ familyId: refreshTokens.familyId })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashToken(body.data.refreshToken)));
    if (row) await app.db.delete(refreshTokens).where(eq(refreshTokens.familyId, row.familyId));
    // idempotent: logging out with an unknown token is still a logout
    return reply.code(204).send();
  });
}

async function issueTokens(
  app: FastifyInstance,
  userId: string,
  user: { email: string; tz: string; displayName: string | null },
  familyId?: string,
) {
  const refresh = newRefreshToken();
  // opportunistic cleanup: expired tokens (including rotation tombstones) are
  // dead weight and the table has no other pruning path
  await app.db
    .delete(refreshTokens)
    .where(and(eq(refreshTokens.userId, userId), lt(refreshTokens.expiresAt, new Date())));
  await app.db.insert(refreshTokens).values({
    userId,
    tokenHash: refresh.tokenHash,
    expiresAt: refresh.expiresAt,
    // rotations stay in the caller's family; logins/registrations start a new one
    ...(familyId ? { familyId } : {}),
  });
  return {
    accessToken: await signAccessToken(userId),
    refreshToken: refresh.token,
    user: { id: userId, email: user.email, tz: user.tz, displayName: user.displayName },
  };
}
