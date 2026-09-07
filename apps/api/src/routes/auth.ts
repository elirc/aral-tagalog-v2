import type { FastifyInstance } from "fastify";
import { and, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { refreshTokens, users, type Db } from "@aral/db";
import { isValidTimeZone } from "@aral/core";
import { hashPassword, hashToken, newRefreshToken, signAccessToken, verifyPassword } from "../auth";
import { env } from "../env";

// tz is stored and later fed to Intl by every progress derivation — an
// unvalidated zone would 500 that user's /me and /sync forever
export const tzSchema = z.string().max(64).refine(isValidTimeZone, "unknown IANA timezone");

const credentialsSchema = z.object({
  email: z.string().trim().max(254).email(),
  password: z.string().min(8).max(200),
  tz: tzSchema.optional(),
  displayName: z.string().max(80).optional(),
});

// tighter than the global limit: these routes run argon2 per request
const authRateLimit = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

/**
 * How long after a rotation the old token may be replayed without it looking
 * like theft. Covers concurrent refreshes from two tabs or two sync workers;
 * long enough for a slow mobile round trip, far shorter than the 30-day token
 * lifetime a real attacker would be working within.
 */
export const REFRESH_REUSE_GRACE_MS = env.refreshReuseGraceMs;
const refreshSchema = z.object({ refreshToken: z.string().min(1).max(256) });
type AuthDb = Pick<Db, "select" | "insert" | "update" | "delete">;

export function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", authRateLimit, async (req, reply) => {
    const body = credentialsSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? "invalid body" });
    const { email, password, tz, displayName } = body.data;

    const existing = await app.db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase()));
    if (existing.length > 0) return reply.code(409).send({ error: "email already registered" });

    const passwordHash = await hashPassword(password);
    try {
      const tokens = await app.db.transaction(async (tx) => {
        const [user] = await tx.insert(users).values({
          email: email.toLowerCase(), passwordHash, tz: tz ?? "UTC", displayName,
        }).returning();
        return issueTokens(tx, user!.id, user!);
      });
      return reply.code(201).send(tokens);
    } catch (err) {
      // concurrent duplicate registration: both pass the SELECT, the loser
      // hits the unique constraint — that's still "already registered"
      const e = err as { code?: string; cause?: { code?: string } };
      if (e.code === "23505" || e.cause?.code === "23505")
        return reply.code(409).send({ error: "email already registered" });
      throw err;
    }
  });

  app.post("/auth/login", authRateLimit, async (req, reply) => {
    const body = credentialsSchema.pick({ email: true, password: true }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid body" });

    const [user] = await app.db.select().from(users).where(eq(users.email, body.data.email.toLowerCase()));
    if (!user || !(await verifyPassword(user.passwordHash, body.data.password)))
      return reply.code(401).send({ error: "invalid email or password" });
    return app.db.transaction((tx) => issueTokens(tx, user.id, user));
  });

  app.post("/auth/refresh", authRateLimit, async (req, reply) => {
    const body = refreshSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid body" });

    const tokenHash = hashToken(body.data.refreshToken);
    const result = await app.db.transaction(async (tx) => {
      const [initial] = await tx.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
      if (!initial) return { status: 401, body: { error: "invalid refresh token" } };

      // Refresh and logout lock the same account, including when they use
      // different generations of a token. A revoked family cannot be
      // resurrected by a replacement INSERT racing the logout DELETE.
      const [user] = await tx.select().from(users).where(eq(users.id, initial.userId)).for("no key update");
      const [row] = await tx.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
      if (!user || !row) return { status: 401, body: { error: "invalid refresh token" } };

      if (row.rotatedAt) {
        if (Date.now() - row.rotatedAt.getTime() <= REFRESH_REUSE_GRACE_MS)
          return { status: 409, body: { error: "refresh already in progress" } };
        await tx.delete(refreshTokens).where(eq(refreshTokens.familyId, row.familyId));
        return { status: 401, body: { error: "refresh token reused" } };
      }
      if (row.expiresAt.getTime() <= Date.now())
        return { status: 401, body: { error: "invalid refresh token" } };

      // Both writes commit together. A failed replacement leaves the original
      // refresh token usable for retry instead of stranding the session.
      await tx.update(refreshTokens).set({ rotatedAt: new Date() }).where(eq(refreshTokens.id, row.id));
      return { status: 200, body: await issueTokens(tx, user.id, user, row.familyId) };
    });
    return reply.code(result.status).send(result.body);
  });

  // Possession of the refresh token is the credential here — no Bearer needed,
  // so a client whose access token already expired can still log out cleanly.
  app.post("/auth/logout", authRateLimit, async (req, reply) => {
    const body = refreshSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid body" });
    await app.db.transaction(async (tx) => {
      const [row] = await tx.select().from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, hashToken(body.data.refreshToken)));
      if (!row) return;
      await tx.select({ id: users.id }).from(users).where(eq(users.id, row.userId)).for("no key update");
      await tx.delete(refreshTokens).where(eq(refreshTokens.familyId, row.familyId));
    });
    // idempotent: logging out with an unknown token is still a logout
    return reply.code(204).send();
  });
}

async function issueTokens(
  db: AuthDb,
  userId: string,
  user: { email: string; tz: string; displayName: string | null },
  familyId?: string,
) {
  const refresh = newRefreshToken();
  // opportunistic cleanup: expired tokens (including rotation tombstones) are
  // dead weight and the table has no other pruning path
  await db
    .delete(refreshTokens)
    .where(and(eq(refreshTokens.userId, userId), lt(refreshTokens.expiresAt, new Date())));
  await db.insert(refreshTokens).values({
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
