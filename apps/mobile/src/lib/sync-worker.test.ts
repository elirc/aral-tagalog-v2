import { beforeEach, describe, expect, it, vi } from "vitest";
import { reduceEvents, type ProgressEvent, type UserProgress } from "@aral/core";
import { ApiError, type AuthTokens } from "./api";
import { ProgressSyncWorker } from "./sync-worker";

vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: { apiUrl: "https://api.example.com" } } } }));

const tokens = (id: string, accessToken = id): AuthTokens => ({
  accessToken,
  refreshToken: `${accessToken}-refresh`,
  user: { id, email: `${id}@example.com`, displayName: null, tz: "UTC" },
});
const event = (id: string): ProgressEvent => ({ id, type: "goal_set", occurredAt: 1, goalXp: 30 });
const progress = (xpTotal = 0): UserProgress => ({ ...reduceEvents([], "UTC", 1), xpTotal });
const reply = (xpTotal = 0) => ({ accepted: 0, rejected: [] as string[], progress: progress(xpTotal) });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup(initialAuth: AuthTokens | null = tokens("alice"), initialEvents = [event("one")]) {
  const state = { auth: initialAuth, events: initialEvents, baseline: null as UserProgress | null, needsRelogin: false };
  const archives = new Map<string, { baseline: UserProgress | null; events: ProgressEvent[] }>();
  const api = {
    sync: vi.fn(async (_token: string, _events: ProgressEvent[]) => reply()),
    refresh: vi.fn(async (_token: string) => tokens("alice", "rotated")),
    logout: vi.fn(async (_token: string) => {}),
    updateMe: vi.fn(async (_token: string, _patch: { tz?: string }) => ({ user: tokens("alice").user })),
  };
  const worker = new ProgressSyncWorker({
    auth: initialAuth,
    api,
    timeZone: () => "UTC",
    storage: {
      outboxAll: () => [...state.events],
      saveAuth: (auth) => { state.auth = auth; },
      commitSync: (baseline, ids) => {
        state.baseline = baseline;
        state.events = state.events.filter((item) => !ids.includes(item.id));
      },
      switchUser: (auth) => {
        if (state.auth?.user.id !== auth?.user.id) {
          const guestEvents = state.auth ? [] : state.events;
          if (state.auth) archives.set(state.auth.user.id, { baseline: state.baseline, events: [...state.events] });
          const restored = auth ? archives.get(auth.user.id) : undefined;
          state.baseline = restored?.baseline ?? null;
          state.events = [...(restored?.events ?? []), ...guestEvents];
          if (auth) archives.delete(auth.user.id);
        }
        state.auth = auth;
        return { baseline: state.baseline, events: [...state.events] };
      },
    },
    onAuth: (auth) => { state.auth = auth; },
    onSynced: vi.fn(),
    onSessionChanged: vi.fn(),
    onNeedsRelogin: (needed) => { state.needsRelogin = needed; },
  });
  return { worker, state, api, archives };
}

describe("mobile progress sync", () => {
  beforeEach(() => vi.clearAllMocks());

  it("serializes overlapping triggers and drains every 500-event batch", async () => {
    const { worker, state, api } = setup(tokens("alice"), Array.from({ length: 1002 }, (_, i) => event(String(i))));
    const first = deferred<ReturnType<typeof reply>>();
    api.sync.mockImplementationOnce(() => first.promise);
    const firstSync = worker.syncNow();
    const secondSync = worker.syncNow();
    expect(api.sync).toHaveBeenCalledTimes(1);
    first.resolve(reply());
    await Promise.all([firstSync, secondSync]);
    expect(api.sync.mock.calls.map(([, events]) => events.length)).toEqual([500, 500, 2]);
    expect(state.events).toEqual([]);
  });

  it("includes events appended while the current batch is in flight", async () => {
    const { worker, state, api } = setup();
    const first = deferred<ReturnType<typeof reply>>();
    api.sync.mockImplementationOnce(() => first.promise);
    const syncing = worker.syncNow();
    state.events.push(event("two"));
    first.resolve(reply());
    await syncing;
    expect(api.sync.mock.calls.map(([, events]) => events.map(({ id }) => id))).toEqual([["one"], ["two"]]);
    expect(state.events).toEqual([]);
  });

  it("ignores a sync response delivered after logout", async () => {
    const { worker, state, api } = setup();
    const first = deferred<ReturnType<typeof reply>>();
    api.sync.mockImplementationOnce(() => first.promise);
    const syncing = worker.syncNow();
    worker.logout();
    first.resolve(reply(500));
    await syncing;
    expect(state).toMatchObject({ auth: null, baseline: null, events: [] });
    expect(api.logout).toHaveBeenCalledWith("alice-refresh");
  });

  it("waits for the old request before syncing another account and discards its response", async () => {
    const { worker, state, api } = setup();
    const first = deferred<ReturnType<typeof reply>>();
    api.sync.mockImplementationOnce(() => first.promise).mockResolvedValueOnce(reply(20));
    const oldSync = worker.syncNow();
    const login = worker.adoptAuth(tokens("bob"));
    expect(api.sync).toHaveBeenCalledTimes(1);
    first.resolve(reply(500));
    await Promise.all([oldSync, login]);
    expect(api.sync.mock.calls.map(([token, events]) => [token, events.map(({ id }) => id)])).toEqual([
      ["alice", ["one"]], ["bob", []],
    ]);
    expect(state.auth?.user.id).toBe("bob");
    expect(state.baseline?.xpTotal).toBe(20);
  });

  it("does not resurrect a logged-out account when refresh resolves", async () => {
    const { worker, state, api } = setup();
    const refresh = deferred<AuthTokens>();
    api.sync.mockRejectedValueOnce(new ApiError(401, "expired"));
    api.refresh.mockImplementationOnce(() => refresh.promise);
    const syncing = worker.syncNow();
    await vi.waitFor(() => expect(api.refresh).toHaveBeenCalledTimes(1));
    worker.logout();
    refresh.resolve(tokens("alice", "fresh"));
    await syncing;
    expect(state.auth).toBeNull();
    expect(state.baseline).toBeNull();
    expect(api.sync).toHaveBeenCalledTimes(1);
  });

  it("ignores a timezone response after account switching", async () => {
    const alice = tokens("alice");
    alice.user.tz = "Asia/Manila";
    const { worker, state, api } = setup(alice);
    const update = deferred<{ user: AuthTokens["user"] }>();
    api.updateMe.mockImplementationOnce(() => update.promise);
    const oldSync = worker.syncNow();
    const login = worker.adoptAuth(tokens("bob"));
    update.resolve({ user: tokens("alice").user });
    await Promise.all([oldSync, login]);
    expect(state.auth?.user.id).toBe("bob");
    expect(api.sync).toHaveBeenCalledTimes(1);
    expect(api.sync).toHaveBeenCalledWith("bob", []);
  });

  it("rotates an expired access token once for concurrent requests", async () => {
    const { worker, api, state } = setup();
    api.sync.mockRejectedValueOnce(new ApiError(401, "expired"));
    await Promise.all([worker.syncNow(), worker.syncNow()]);
    expect(api.refresh).toHaveBeenCalledTimes(1);
    expect(api.refresh).toHaveBeenCalledWith("alice-refresh");
    expect(api.sync.mock.calls.slice(1).every(([token]) => token === "rotated")).toBe(true);
    expect(state.auth?.accessToken).toBe("rotated");
    expect(state.events).toEqual([]);
  });

  it("keeps offline changes for the next attempt", async () => {
    const { worker, state, api } = setup();
    api.sync.mockRejectedValueOnce(new Error("offline"));
    await worker.syncNow();
    expect(state.events.map(({ id }) => id)).toEqual(["one"]);
    expect(state.baseline).toBeNull();
    await worker.syncNow();
    expect(state.events).toEqual([]);
  });

  it("retains changes and stops retrying rejected refresh tokens until login", async () => {
    const { worker, state, api } = setup();
    api.sync.mockRejectedValueOnce(new ApiError(401, "expired"));
    api.refresh.mockRejectedValueOnce(new ApiError(401, "revoked"));
    await worker.syncNow();
    expect(state.needsRelogin).toBe(true);
    await worker.syncNow();
    expect(api.sync).toHaveBeenCalledTimes(1);
    expect(state.events).toHaveLength(1);
    await worker.adoptAuth(tokens("alice", "new-login"));
    expect(api.sync).toHaveBeenLastCalledWith("new-login", [event("one")]);
    expect(state.needsRelogin).toBe(false);
  });

  it("carries guest progress into the first account", async () => {
    const { worker, api } = setup(null);
    await worker.adoptAuth(tokens("alice"));
    expect(api.sync).toHaveBeenCalledTimes(1);
    expect(api.sync).toHaveBeenCalledWith("alice", [event("one")]);
  });
  it("restores offline progress after logout and a later login to the same account", async () => {
    const { worker, state, api, archives } = setup();
    state.baseline = progress(125);
    api.sync.mockRejectedValue(new Error("offline"));
    await worker.syncNow();
    worker.logout();
    expect(state).toMatchObject({ auth: null, baseline: null, events: [] });
    expect(archives.get("alice")).toEqual({ baseline: progress(125), events: [event("one")] });

    await worker.adoptAuth(tokens("alice", "new-login"));
    expect(state.baseline?.xpTotal).toBe(125);
    expect(state.events).toEqual([event("one")]);
    api.sync.mockResolvedValue(reply(130));
    await worker.syncNow();
    expect(api.sync).toHaveBeenLastCalledWith("new-login", [event("one")]);
    expect(state.events).toEqual([]);
  });

  it("keeps each account's offline work separate through direct switches and logout", async () => {
    const { worker, state, api, archives } = setup();
    state.baseline = progress(125);
    api.sync.mockRejectedValue(new Error("offline"));
    await worker.adoptAuth(tokens("bob"));
    expect(state.events).toEqual([]);
    expect(state.baseline).toBeNull();
    state.events.push(event("bobs-work"));
    worker.logout();
    state.events.push(event("guest-work"));
    await worker.adoptAuth(tokens("alice", "new-login"));
    expect(state.baseline?.xpTotal).toBe(125);
    expect(state.events).toEqual([event("one"), event("guest-work")]);
    expect(archives.get("bob")?.events).toEqual([event("bobs-work")]);
    expect(api.sync).toHaveBeenLastCalledWith("new-login", [event("one"), event("guest-work")]);
  });
});
