import { beforeEach, describe, expect, it, vi } from "vitest";
import * as SQLite from "expo-sqlite";
import { reduceEvents, type ProgressEvent } from "@aral/core";
import type { AuthTokens } from "./api";
import { commitSync, kvGet, kvSet, outboxAdd, outboxAll, switchUser, type LocalProgressSnapshot } from "./storage";

// Exercise the real SQL/transactions with Node's SQLite engine. Only the Expo
// binding is adapted; account switching and rollback run against a database.
vi.mock("expo-sqlite", async () => {
  const { createRequire } = await import("node:module");
  const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
  const connection = new DatabaseSync(":memory:");
  const database = {
    execSync: (sql: string) => connection.exec(sql),
    runSync: (sql: string, ...params: (string | number)[]) => connection.prepare(sql).run(...params),
    getFirstSync: (sql: string, ...params: (string | number)[]) => connection.prepare(sql).get(...params),
    getAllSync: (sql: string, ...params: (string | number)[]) => connection.prepare(sql).all(...params),
    withTransactionSync: (callback: () => void) => {
      connection.exec("BEGIN");
      try {
        callback();
        connection.exec("COMMIT");
      } catch (error) {
        connection.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return { openDatabaseSync: () => database };
});

const database = SQLite.openDatabaseSync("aral.db");
const tokens = (id: string): AuthTokens => ({
  accessToken: `${id}-access`, refreshToken: `${id}-secret-refresh`,
  user: { id, email: `${id}@example.com`, displayName: null, tz: "UTC" },
});
const event = (id: string): ProgressEvent => ({ id, type: "goal_set", occurredAt: 1, goalXp: 30 });
const baseline = { ...reduceEvents([], "UTC", 1), xpTotal: 125 };

beforeEach(() => {
  vi.restoreAllMocks();
  database.execSync("DELETE FROM kv; DELETE FROM outbox;");
});

describe("SQLite account progress persistence", () => {
  it("archives offline progress on logout without retaining account tokens", () => {
    kvSet("auth", tokens("alice"));
    kvSet("baseline", baseline);
    kvSet("theme", "dark");
    outboxAdd([event("pending")]);
    expect(switchUser(null)).toEqual({ baseline: null, events: [] });
    expect(kvGet("auth")).toBeNull();
    expect(kvGet("theme")).toBe("dark");
    const archived = kvGet<LocalProgressSnapshot>("account-progress:alice");
    expect(archived).toEqual({ baseline, events: [event("pending")] });
    expect(JSON.stringify(archived)).not.toContain("secret-refresh");
    expect(switchUser(tokens("alice"))).toEqual({ baseline, events: [event("pending")] });
    expect(kvGet("account-progress:alice")).toBeNull();
  });

  it("isolates account archives and merges guest events only into the chosen account", () => {
    kvSet("auth", tokens("alice"));
    kvSet("baseline", baseline);
    outboxAdd([event("alice-work")]);
    expect(switchUser(tokens("bob"))).toEqual({ baseline: null, events: [] });
    outboxAdd([event("bob-work")]);
    switchUser(null);
    outboxAdd([event("guest-work")]);
    expect(switchUser(tokens("alice"))).toEqual({ baseline, events: [event("alice-work"), event("guest-work")] });
    expect(kvGet<LocalProgressSnapshot>("account-progress:bob")?.events).toEqual([event("bob-work")]);
    expect(switchUser(tokens("bob"))).toEqual({ baseline: null, events: [event("bob-work")] });
  });

  it("preserves active work on same-account login and avoids duplicate guest merges", () => {
    outboxAdd([event("guest")]);
    switchUser(tokens("alice"));
    kvSet("baseline", baseline);
    outboxAdd([event("alice-work")]);
    expect(switchUser(tokens("alice"))).toEqual({ baseline, events: [event("guest"), event("alice-work")] });
    switchUser(null);
    expect(switchUser(tokens("alice"))).toEqual({ baseline, events: [event("guest"), event("alice-work")] });
  });

  it("rolls the entire switch back if storage fails after changing auth and baseline", () => {
    kvSet("auth", tokens("alice"));
    kvSet("baseline", baseline);
    outboxAdd([event("pending")]);
    vi.spyOn(database, "execSync").mockImplementationOnce(() => { throw new Error("disk failure"); });
    expect(() => switchUser(tokens("bob"))).toThrow("disk failure");
    expect(kvGet("auth")).toEqual(tokens("alice"));
    expect(kvGet("baseline")).toEqual(baseline);
    expect(outboxAll()).toEqual([event("pending")]);
    expect(kvGet("account-progress:alice")).toBeNull();
  });

  it("keeps events added after the acknowledged batch", () => {
    outboxAdd([event("accepted"), event("newer")]);
    commitSync(baseline, ["accepted"]);
    expect(kvGet("baseline")).toEqual(baseline);
    expect(outboxAll()).toEqual([event("newer")]);
  });

  it("rolls a baseline update back if deleting acknowledged events fails", () => {
    outboxAdd([event("pending")]);
    const original = database.runSync.bind(database);
    vi.spyOn(database, "runSync")
      .mockImplementationOnce(original)
      .mockImplementationOnce(() => { throw new Error("disk failure"); });
    expect(() => commitSync(baseline, ["pending"])).toThrow("disk failure");
    expect(kvGet("baseline")).toBeNull();
    expect(outboxAll()).toEqual([event("pending")]);
  });
});
