import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app";
import { signAccessToken } from "./auth";
import { randomUUID } from "node:crypto";

// These routes never touch the database (postgres-js connects lazily), so the
// app can be exercised end-to-end with inject() and no Postgres running.
let app: ReturnType<typeof buildApp>;

beforeAll(async () => {
  app = buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});
afterEach(() => vi.restoreAllMocks());

describe("GET /health", () => {
  it("responds 200 ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});

describe("readiness and private responses", () => {
  it("returns 503 without database details when storage is unavailable", async () => {
    vi.spyOn(app.db, "execute").mockRejectedValue(new Error("postgres://secret:password@internal/db"));
    const response = await app.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ ok: false });
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("never caches authentication errors", async () => {
    const response = await app.inject({ method: "GET", url: "/me" });
    expect(response.statusCode).toBe(401);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("rejects an empty profile patch before querying storage", async () => {
    const update = vi.spyOn(app.db, "update");
    const response = await app.inject({
      method: "PATCH", url: "/me", payload: {},
      headers: { authorization: `Bearer ${await signAccessToken(randomUUID())}` },
    });
    expect(response.statusCode).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("GET /content/courses/:courseId/manifest", () => {
  it("404s for an unknown course", async () => {
    const res = await app.inject({ method: "GET", url: "/content/courses/unknown/manifest" });
    expect(res.statusCode).toBe(404);
  });
});

describe("GET /content/bundles/:name", () => {
  it("400s on an encoded path-traversal name", async () => {
    const res = await app.inject({ method: "GET", url: "/content/bundles/..%2Fsecret.json" });
    expect(res.statusCode).toBe(400);
  });

  it("400s on a name outside the course_<base>_<target> allowlist", async () => {
    const res = await app.inject({ method: "GET", url: "/content/bundles/evil.json" });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /content/audio/:file", () => {
  it("never serves a raw path-traversal URL", async () => {
    const res = await app.inject({ method: "GET", url: "/content/audio/../../etc/passwd" });
    // literal "../" segments can't match the single-segment :file route, so
    // this is rejected by the router (404) before the allowlist even runs
    expect([400, 404]).toContain(res.statusCode);
    expect(res.statusCode).not.toBe(200);
  });

  it("400s on an encoded path-traversal filename", async () => {
    const res = await app.inject({ method: "GET", url: "/content/audio/..%2F..%2Fetc%2Fpasswd" });
    expect(res.statusCode).toBe(400);
  });

  it("400s on a disallowed extension", async () => {
    const res = await app.inject({ method: "GET", url: "/content/audio/x.exe" });
    expect(res.statusCode).toBe(400);
  });

  it("404s on a well-formed name with no file behind it", async () => {
    const res = await app.inject({ method: "GET", url: "/content/audio/nope.mp3" });
    expect(res.statusCode).toBe(404);
  });
});
