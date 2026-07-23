import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { createDb, type Db } from "@aral/db";
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
  const app = Fastify({ logger: opts.logger ?? !process.env.VITEST });
  // reflect any origin only in dev; deployments set CORS_ORIGIN
  app.register(cors, { origin: env.corsOrigins ?? env.isDevelopment });
  // global ceiling; auth routes carry tighter per-route limits (argon2 is
  // deliberately expensive — unthrottled it's a credential-stuffing and
  // CPU-exhaustion vector)
  app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  app.decorate("db", createDb(opts.databaseUrl ?? env.databaseUrl));

  app.get("/health", async () => ({ ok: true }));
  // routes live in a child context that loads *after* the plugins above —
  // registered directly on the root they'd be added before @fastify/rate-limit
  // loads, and its route hooks (incl. per-route auth limits) would never attach
  app.register(async (instance) => {
    authRoutes(instance);
    contentRoutes(instance);
    syncRoutes(instance);
    meRoutes(instance);
  });
  return app;
}
