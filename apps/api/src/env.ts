import "dotenv/config";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contentPkg = resolve(here, "..", "..", "..", "packages", "content");

const nodeEnv = process.env.NODE_ENV ?? "";
const isDevelopment = nodeEnv === "development";

export const env = {
  isDevelopment,
  databaseUrl: process.env.DATABASE_URL ?? "postgres://aral:aral@localhost:5433/aral",
  // fail closed: the well-known dev secret is usable only when the process
  // explicitly opts into development — a deploy that forgets NODE_ENV must
  // not silently sign tokens with a publicly-committed secret
  jwtSecret: process.env.JWT_SECRET ?? (isDevelopment ? "dev-secret-change-me" : ""),
  port: Number(process.env.PORT ?? 3001),
  contentDir: process.env.CONTENT_DIR ?? join(contentPkg, "dist"),
  audioDir: process.env.AUDIO_DIR ?? join(contentPkg, "audio", "en-tl"),
  /** comma-separated browser origins allowed by CORS; unset = dev-only wildcard */
  corsOrigins: process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()).filter(Boolean),
  accessTokenTtl: "15m",
  refreshTokenTtlMs: 30 * 24 * 60 * 60 * 1000,
};

if (!env.jwtSecret) {
  throw new Error("JWT_SECRET must be set (or run with NODE_ENV=development to use the dev fallback)");
}
if (!isDevelopment && env.jwtSecret === "dev-secret-change-me") {
  throw new Error("JWT_SECRET must not be the dev placeholder outside development");
}
