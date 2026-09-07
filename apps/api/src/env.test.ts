import { describe, expect, it } from "vitest";
import { readEnv } from "./env";

const production = { NODE_ENV: "production", JWT_SECRET: "a".repeat(48), DATABASE_URL: "postgres://user:pass@db/aral" };

describe("deployment configuration", () => {
  it("requires explicit credentials even if NODE_ENV was forgotten", () => {
    expect(() => readEnv({})).toThrow("JWT_SECRET");
    expect(() => readEnv({ JWT_SECRET: production.JWT_SECRET })).toThrow("DATABASE_URL");
    expect(() => readEnv({ ...production, JWT_SECRET: "short" })).toThrow("JWT_SECRET");
    expect(() => readEnv({ ...production, JWT_SECRET: "dev-secret-change-me" })).toThrow("JWT_SECRET");
  });

  it("retains explicit local development defaults", () => {
    expect(readEnv({ NODE_ENV: "development" })).toMatchObject({ port: 3001, trustProxy: false, isDevelopment: true });
  });

  it.each([
    { PORT: "invalid" }, { PORT: "0" }, { PORT: "65536" },
    { TRUST_PROXY: "yes" }, { REFRESH_REUSE_GRACE_MS: "NaN" },
    { REFRESH_REUSE_GRACE_MS: "-1" }, { REFRESH_REUSE_GRACE_MS: "300001" },
    { DATABASE_URL: "https://db.example" }, { CORS_ORIGIN: "*" },
    { CORS_ORIGIN: "https://aral.example/login" }, { CORS_ORIGIN: "https://aral.example/" },
  ])("rejects malformed settings before listening: %j", (settings) => {
    expect(() => readEnv({ ...production, ...settings })).toThrow();
  });

  it("accepts exact origins and an explicitly disabled refresh grace window", () => {
    expect(readEnv({ ...production, CORS_ORIGIN: "https://aral.example, https://other.example", REFRESH_REUSE_GRACE_MS: "0" }))
      .toMatchObject({ corsOrigins: ["https://aral.example", "https://other.example"], refreshReuseGraceMs: 0 });
  });
});
