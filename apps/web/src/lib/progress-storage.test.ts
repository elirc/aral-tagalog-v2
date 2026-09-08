import { describe, expect, it, vi } from "vitest";
import { reduceEvents, type ProgressEvent } from "@aral/core";
import { authScope, GUEST_SCOPE, ProgressStorage } from "./progress-storage";
import type { AuthTokens } from "./api";

class TestStorage implements Storage {
  values = new Map<string, string>();
  failWrites = false;
  failRemovals = false;
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error("Quota exceeded");
    this.values.set(key, value);
  }
  removeItem(key: string) {
    if (this.failRemovals) throw new Error("Storage unavailable");
    this.values.delete(key);
  }
  clear() { this.values.clear(); }
}

const auth: AuthTokens = {
  accessToken: "access", refreshToken: "refresh",
  user: { id: "account-a", email: "a@example.com", tz: "UTC", displayName: null },
};
const event = (id: string): ProgressEvent => ({ id, type: "goal_set", goalXp: 50, occurredAt: 1000 });
const scope = authScope(auth);

describe("offline progress storage", () => {
  it("keeps simultaneous tab appends instead of replacing a stale outbox", () => {
    const disk = new TestStorage();
    const first = new ProgressStorage(disk);
    const second = new ProgressStorage(disk);
    first.readProgress(scope);
    second.readProgress(scope);
    first.append(scope, [event("first")]);
    second.append(scope, [event("second")]);
    expect(first.readProgress(scope).outbox.map((e) => e.id)).toEqual(["first", "second"]);
  });

  it("only removes the acknowledged batch, preserving events appended during a request", () => {
    const storage = new ProgressStorage(new TestStorage());
    storage.append(scope, [event("sent"), event("later")]);
    const progress = reduceEvents([event("sent")], "UTC", 2000);
    storage.settle(scope, progress, ["sent"]);
    expect(storage.readProgress(scope)).toMatchObject({ baseline: progress, outbox: [event("later")] });
  });

  it("does not replay accepted events when the tab closes before journal cleanup", () => {
    const disk = new TestStorage();
    const storage = new ProgressStorage(disk);
    storage.append(scope, [event("sent")]);
    disk.failRemovals = true;
    storage.settle(scope, reduceEvents([event("sent")], "UTC", 2000), ["sent"]);
    const reloaded = new ProgressStorage(disk).readProgress(scope);
    expect(reloaded.outbox).toEqual([]);
    expect(reloaded.baseline?.dailyGoalXp).toBe(50);
  });

  it("keeps new progress in memory and reports storage quota failures", () => {
    const disk = new TestStorage();
    const onFailure = vi.fn();
    const storage = new ProgressStorage(disk, onFailure);
    storage.append(scope, [event("saved")]);
    storage.readProgress(scope);
    disk.failWrites = true;
    expect(() => storage.append(scope, [event("pending")])).not.toThrow();
    expect(storage.readProgress(scope).outbox.map((e) => e.id)).toEqual(["pending", "saved"]);
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it("retains each account's unsynced work across logout without assigning it to a new account", () => {
    const storage = new ProgressStorage(new TestStorage());
    storage.writeAuth(auth);
    storage.append(scope, [event("private")]);
    storage.writeAuth(null);
    expect(storage.readProgress(GUEST_SCOPE).outbox).toEqual([]);
    const other = { ...auth, user: { ...auth.user, id: "account-b" } };
    storage.writeAuth(other);
    expect(storage.readProgress(authScope(other)).outbox).toEqual([]);
    storage.writeAuth(auth);
    expect(storage.readProgress(scope).outbox).toEqual([event("private")]);
  });

  it("merges guest progress with retained account progress once", () => {
    const storage = new ProgressStorage(new TestStorage());
    storage.append(GUEST_SCOPE, [event("guest")]);
    storage.append(scope, [event("account")]);
    storage.adoptGuest(scope);
    storage.adoptGuest(scope);
    expect(storage.readProgress(scope).outbox.map((e) => e.id)).toEqual(["account", "guest"]);
    expect(storage.readProgress(GUEST_SCOPE).outbox).toEqual([]);
  });

  it("migrates the previous format without losing its account owner or baseline", () => {
    const disk = new TestStorage();
    const baseline = reduceEvents([], "UTC", 2000);
    disk.setItem("aral.auth", JSON.stringify(auth));
    disk.setItem("aral.outbox", JSON.stringify([event("old")]));
    disk.setItem("aral.baseline", JSON.stringify(baseline));
    const storage = new ProgressStorage(disk);
    storage.migrateLegacy();
    storage.migrateLegacy();
    expect(storage.readProgress(scope)).toEqual({ outbox: [event("old")], baseline });
    expect(storage.readProgress(GUEST_SCOPE).outbox).toEqual([]);
    expect(disk.getItem("aral.outbox")).toBeNull();
  });

  it("ignores malformed persisted records instead of crashing the course page", () => {
    const disk = new TestStorage();
    disk.setItem("aral.auth", JSON.stringify({ user: null }));
    disk.setItem("aral.outbox", JSON.stringify([null, {}, { ...event("bad"), occurredAt: "yesterday" }, event("valid")]));
    disk.setItem("aral.baseline", JSON.stringify({ completedLessonIds: 42 }));
    const storage = new ProgressStorage(disk);
    expect(() => storage.migrateLegacy()).not.toThrow();
    expect(storage.readAuth()).toBeNull();
    expect(storage.readProgress(GUEST_SCOPE)).toEqual({ outbox: [event("valid")], baseline: null });
  });

  it("continues a guest session when localStorage is blocked entirely", () => {
    const onFailure = vi.fn();
    const storage = new ProgressStorage(null, onFailure);
    storage.append(GUEST_SCOPE, [event("memory")]);
    expect(storage.readProgress(GUEST_SCOPE).outbox).toEqual([event("memory")]);
    expect(onFailure).toHaveBeenCalledTimes(1);
  });
});
