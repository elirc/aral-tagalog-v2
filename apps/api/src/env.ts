import "dotenv/config";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contentPkg = resolve(here, "..", "..", "..", "packages", "content");

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "postgres://aral:aral@localhost:5433/aral",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  port: Number(process.env.PORT ?? 3001),
  contentDir: process.env.CONTENT_DIR ?? join(contentPkg, "dist"),
  audioDir: process.env.AUDIO_DIR ?? join(contentPkg, "audio", "en-tl"),
  accessTokenTtl: "15m",
  refreshTokenTtlMs: 30 * 24 * 60 * 60 * 1000,
};

if (process.env.NODE_ENV === "production" && env.jwtSecret === "dev-secret-change-me") {
  throw new Error("JWT_SECRET must be set in production");
}
