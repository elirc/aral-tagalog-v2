import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { createDb, type Db } from "@aral/db";
import { sql } from "drizzle-orm";
import { catalog } from "./catalog";
import { env } from "./env";
import { authRoutes } from "./routes/auth";
import { contentRoutes } from "./routes/content";
import { meRoutes } from "./routes/me";
import { syncRoutes } from "./routes/sync";

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
  }
}

export function buildApp(opts: { databaseUrl?: string; logger?: boolean } = {}) {
  // silence request logs under vitest; every injected request would print pino JSON
  const app = Fastify({
    logger: (opts.logger ?? !process.env.VITEST)
      ? { redact: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie"] }
      : false,
    // makes req.ip the client address rather than the proxy's, so the rate
    // limiter buckets per user instead of per deployment (see env.trustProxy)
    trustProxy: env.trustProxy,
  });
  // reflect any origin only in dev; deployments set CORS_ORIGIN
  app.register(cors, { origin: env.corsOrigins ?? env.isDevelopment });
  // global ceiling; auth routes carry tighter per-route limits (argon2 is
  // deliberately expensive — unthrottled it's a credential-stuffing and
  // CPU-exhaustion vector)
  app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  app.decorate("db", createDb(opts.databaseUrl ?? env.databaseUrl));
  // release the pg pool on close so graceful shutdown actually finishes
  app.addHook("onClose", async () => {
    await app.db.$client.end({ timeout: 5 });
  });

  // Expected errors (validation, rate limit, auth) keep their message; an
  // unexpected throw must not leak internals — pg error strings can contain
  // query fragments and connection details.
  app.setErrorHandler((err: FastifyError, req, reply) => {
    const status = err.statusCode ?? 500;
    if (status >= 500) {
      req.log.error(err);
      return reply.code(500).send({ error: "internal error" });
    }
    return reply.code(status).send({ error: err.message });
  });

  app.get("/health", async () => ({ ok: true }));
  app.get("/ready", async (req, reply) => {
    reply.header("cache-control", "no-store");
    if (!catalog) return reply.code(503).send({ ok: false });
    try {
      // LIMIT 0 checks connectivity and the required migrations without
      // reading personal data, even when these tables are empty.
      await app.db.execute(sql`select users.id, refresh_tokens.family_id,
        refresh_tokens.rotated_at, progress_events.id
        from users, refresh_tokens, progress_events limit 0`);
      return { ok: true };
    } catch (error) {
      req.log.error(error, "readiness database check failed");
      return reply.code(503).send({ ok: false });
    }
  });
  // routes live in a child context that loads *after* the plugins above —
  // registered directly on the root they'd be added before @fastify/rate-limit
  // loads, and its route hooks (incl. per-route auth limits) would never attach
  app.register(async (instance) => {
    instance.addHook("onSend", async (req, reply) => {
      reply.header("x-content-type-options", "nosniff");
      if (!req.url.startsWith("/content/")) reply.header("cache-control", "no-store");
    });
    authRoutes(instance);
    contentRoutes(instance);
    syncRoutes(instance);
    meRoutes(instance);
  });
  return app;
}
