import "dotenv/config";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contentPkg = resolve(here, "..", "..", "..", "packages", "content");

export function readEnv(source: NodeJS.ProcessEnv) {
  const isDevelopment = source.NODE_ENV === "development";
  const jwtSecret = source.JWT_SECRET ?? (isDevelopment ? "dev-secret-change-me" : "");
  if (!jwtSecret || (!isDevelopment && (jwtSecret === "dev-secret-change-me" || jwtSecret.startsWith("replace-") || Buffer.byteLength(jwtSecret) < 32))) {
    throw new Error("JWT_SECRET must contain at least 32 bytes outside development; generate a random secret");
  }

  const databaseUrl = source.DATABASE_URL ?? (isDevelopment ? "postgres://aral:aral@localhost:5433/aral" : "");
  try {
    const parsed = new URL(databaseUrl);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.hostname) throw new Error();
  } catch {
    throw new Error("DATABASE_URL must be an explicit PostgreSQL connection URL outside development");
  }

  const port = Number(source.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be an integer between 1 and 65535");
  if (source.TRUST_PROXY !== undefined && !["true", "false"].includes(source.TRUST_PROXY)) {
    throw new Error("TRUST_PROXY must be true or false");
  }
  const refreshReuseGraceMs = Number(source.REFRESH_REUSE_GRACE_MS ?? 60_000);
  if (!Number.isInteger(refreshReuseGraceMs) || refreshReuseGraceMs < 0 || refreshReuseGraceMs > 300_000) {
    throw new Error("REFRESH_REUSE_GRACE_MS must be an integer between 0 and 300000");
  }
  const corsOrigins = source.CORS_ORIGIN?.split(",").map((value) => value.trim()).filter(Boolean);
  for (const origin of corsOrigins ?? []) {
    try {
      const parsed = new URL(origin);
      if (!["https:", "http:"].includes(parsed.protocol) || parsed.origin !== origin) throw new Error();
    } catch {
      throw new Error("CORS_ORIGIN must contain comma-separated HTTP(S) origins without paths or trailing slashes");
    }
  }

  return {
    isDevelopment,
    databaseUrl,
    jwtSecret,
    port,
    host: source.HOST ?? "0.0.0.0",
    // Enable only behind a reverse proxy that overwrites forwarded headers.
    trustProxy: source.TRUST_PROXY === "true",
    contentDir: source.CONTENT_DIR ?? join(contentPkg, "dist"),
    audioDir: source.AUDIO_DIR ?? join(contentPkg, "audio", "en-tl"),
    corsOrigins,
    refreshReuseGraceMs,
    accessTokenTtl: "15m",
    refreshTokenTtlMs: 30 * 24 * 60 * 60 * 1000,
  };
}

export const env = readEnv(process.env);
