import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { refreshTokens, users } from "@aral/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app";
import { hashToken } from "./auth";
import { env } from "./env";

// CI supplies a disposable, migrated Postgres database. Only each test's own
// random account is deleted, so this suite never truncates shared tables.
describe.skipIf(!process.env.TEST_DATABASE_URL)("Postgres authentication lifecycle", () => {
  let app: ReturnType<typeof buildApp>;
  let auth: { refreshToken: string; accessToken: string; user: { id: string } };

  beforeEach(async () => {
    app = buildApp({ databaseUrl: process.env.TEST_DATABASE_URL!, logger: false });
    await app.ready();
    const response = await app.inject({
      method: "POST", url: "/auth/register",
      payload: { email: `integration-${randomUUID()}@example.test`, password: "integration-test-password", tz: "UTC" },
    });
    expect(response.statusCode).toBe(201);
    auth = response.json();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (auth?.user?.id) await app.db.delete(users).where(eq(users.id, auth.user.id));
    await app?.close();
  });

  const refresh = (refreshToken: string) => app.inject({ method: "POST", url: "/auth/refresh", payload: { refreshToken } });

  it("reports ready only against a migrated database", async () => {
    const response = await app.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it("allows one concurrent refresh without revoking the winning session", async () => {
    const responses = await Promise.all([refresh(auth.refreshToken), refresh(auth.refreshToken)]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    const winner = responses.find((response) => response.statusCode === 200)!.json();
    expect((await refresh(winner.refreshToken)).statusCode).toBe(200);
  });

  it("rolls rotation back when the replacement token cannot be inserted", async () => {
    const transaction = app.db.transaction.bind(app.db);
    const failure = vi.spyOn(app.db, "transaction").mockImplementation((callback, config) =>
      transaction(async (tx) => {
        const insert = vi.spyOn(tx, "insert").mockImplementation(() => {
          throw new Error("simulated token insert failure");
        });
        try { return await callback(tx); } finally { insert.mockRestore(); }
      }, config),
    );
    const response = await refresh(auth.refreshToken);
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "internal error" });
    failure.mockRestore();

    const [original] = await app.db.select().from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashToken(auth.refreshToken)));
    expect(original!.rotatedAt).toBeNull();
    expect((await refresh(auth.refreshToken)).statusCode).toBe(200);
  });

  it("does not resurrect a token family when logout races refresh", async () => {
    const [rotated, loggedOut] = await Promise.all([
      refresh(auth.refreshToken),
      app.inject({ method: "POST", url: "/auth/logout", payload: { refreshToken: auth.refreshToken } }),
    ]);
    expect(loggedOut.statusCode).toBe(204);
    expect([200, 401]).toContain(rotated.statusCode);
    if (rotated.statusCode === 200) expect((await refresh(rotated.json().refreshToken)).statusCode).toBe(401);
    expect(await app.db.select().from(refreshTokens).where(eq(refreshTokens.userId, auth.user.id))).toHaveLength(0);
  });

  it("revokes the current token after an old token is replayed beyond the grace window", async () => {
    const rotated = await refresh(auth.refreshToken);
    expect(rotated.statusCode).toBe(200);
    await app.db.update(refreshTokens)
      .set({ rotatedAt: new Date(Date.now() - env.refreshReuseGraceMs - 1000) })
      .where(eq(refreshTokens.tokenHash, hashToken(auth.refreshToken)));
    expect((await refresh(auth.refreshToken)).statusCode).toBe(401);
    expect((await refresh(rotated.json().refreshToken)).statusCode).toBe(401);
  });
});
