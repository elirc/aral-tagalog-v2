import Fastify from "fastify";
import cors from "@fastify/cors";
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

export function buildApp(opts: { databaseUrl?: string } = {}) {
  const app = Fastify({ logger: true });
  app.register(cors, { origin: true });
  app.decorate("db", createDb(opts.databaseUrl ?? env.databaseUrl));

  app.get("/health", async () => ({ ok: true }));
  authRoutes(app);
  contentRoutes(app);
  syncRoutes(app);
  meRoutes(app);
  return app;
}
