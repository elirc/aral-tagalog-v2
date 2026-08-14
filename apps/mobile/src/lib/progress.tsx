import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { reduceEvents, type ProgressEvent, type UserProgress } from "@aral/core";
import { api, ApiError, type AuthTokens, type AuthUser } from "./api";
import { kvGet, kvSet, outboxAdd, outboxAll, outboxClear, wipeAll } from "./storage";

/**
 * Same event-sourced model as the web app, persisted in SQLite (OFF-02):
 * progress = server baseline (last /sync response) + unsynced outbox events.
 * The sync worker flushes the outbox when the app foregrounds or events land.
 */

export function deviceTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

interface ProgressContextValue {
  progress: UserProgress;
  user: AuthUser | null;
  addEvents: (events: ProgressEvent[]) => void;
  adoptAuth: (tokens: AuthTokens) => Promise<void>;
  logout: () => void;
  syncNow: () => Promise<void>;
  pendingCount: number;
  /** refresh token was rejected: still "logged in" locally but nothing syncs */
  needsRelogin: boolean;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [outbox, setOutbox] = useState<ProgressEvent[]>(() => outboxAll());
  const [baseline, setBaseline] = useState<UserProgress | null>(() => kvGet<UserProgress>("baseline"));
  const [auth, setAuth] = useState<AuthTokens | null>(() => kvGet<AuthTokens>("auth"));
  const [needsRelogin, setNeedsRelogin] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const progress = useMemo(
    () => reduceEvents(outbox, deviceTz(), Date.now(), baseline ?? undefined),
    [outbox, baseline, tick],
  );

  const addEvents = useCallback((events: ProgressEvent[]) => {
    outboxAdd(events);
    setOutbox(outboxAll());
  }, []);

  const syncWith = useCallback(async (tokens: AuthTokens, events: ProgressEvent[]) => {
    // the server caps batches at 500; leftovers flush on the next debounce
    const batch = events.slice(0, 500);
    const push = async (t: AuthTokens) => {
      const { progress: serverProgress } = await api.sync(t.accessToken, batch);
      kvSet("baseline", serverProgress);
      setBaseline(serverProgress);
      outboxClear(batch.map((e) => e.id));
      setOutbox(outboxAll());
    };
    try {
      await push(tokens);
      setNeedsRelogin(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // access token expired: rotate via refresh token, retry once
        let fresh: AuthTokens;
        try {
          fresh = await api.refresh(tokens.refreshToken);
        } catch (refreshErr) {
          // dead refresh token: the user looks logged in but nothing will
          // ever sync — surface it instead of failing silently forever
          if (refreshErr instanceof ApiError && refreshErr.status === 401) setNeedsRelogin(true);
          throw refreshErr;
        }
        kvSet("auth", fresh);
        setAuth(fresh);
        await push(fresh);
        setNeedsRelogin(false);
      } else {
        throw err; // offline — outbox stays for the next attempt (OFF-02)
      }
    }
  }, []);

  // One /sync at a time: launch, the debounce effect, and the foreground
  // handler can all fire at once. Overlapping syncs present the same refresh
  // token to the server and can apply an older progress snapshot last.
  const syncingRef = useRef(false);
  const syncNow = useCallback(async () => {
    if (!auth || syncingRef.current) return;
    syncingRef.current = true;
    try {
      await syncWith(auth, outboxAll());
    } catch {
      // offline — the outbox keeps the events for the next attempt (OFF-02)
    } finally {
      syncingRef.current = false;
    }
  }, [auth, syncWith]);

  const adoptAuth = useCallback(
    async (tokens: AuthTokens) => {
      // logging in as a different account must not push the previous user's
      // unsynced events into it; guest carry-over (auth === null) still works
      const switchingUser = auth !== null && auth.user.id !== tokens.user.id;
      if (switchingUser) {
        outboxClear(outboxAll().map((e) => e.id));
        kvSet("baseline", null);
        setBaseline(null);
        setOutbox([]);
      }
      kvSet("auth", tokens);
      setAuth(tokens);
      setNeedsRelogin(false);
      await syncWith(tokens, switchingUser ? [] : outboxAll()).catch(() => {});
    },
    [auth, syncWith],
  );

  const logout = useCallback(() => {
    // best-effort server-side revocation of this device's refresh-token family
    if (auth) void api.logout(auth.refreshToken).catch(() => {});
    wipeAll();
    setNeedsRelogin(false);
    setAuth(null);
    setBaseline(null);
    setOutbox([]);
  }, [auth]);

  // sync worker: on new events (debounced) and when the app foregrounds
  useEffect(() => {
    if (!auth || outbox.length === 0) return;
    const t = setTimeout(() => void syncNow(), 2000);
    return () => clearTimeout(t);
  }, [auth, outbox, syncNow]);

  useEffect(() => {
    // launch counts as "coming to the foreground": pull server truth right
    // away so progress made on other devices shows without a background/resume
    void syncNow();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncNow();
    });
    return () => sub.remove();
  }, [syncNow]);

  // keep the server-side tz current: the server buckets streak/xpByDay days
  // with users.tz, clients with the device zone — they must agree (GAM-02)
  useEffect(() => {
    if (!auth) return;
    const tz = deviceTz();
    if (auth.user.tz === tz) return;
    api
      .updateMe(auth.accessToken, { tz })
      .then(({ user }) => {
        const next = { ...auth, user };
        kvSet("auth", next);
        setAuth(next);
      })
      .catch(() => {}); // best-effort; retried after the next token refresh
  }, [auth]);

  const value = useMemo(
    () => ({
      progress,
      user: auth?.user ?? null,
      addEvents,
      adoptAuth,
      logout,
      syncNow,
      pendingCount: outbox.length,
      needsRelogin,
    }),
    [progress, auth, addEvents, adoptAuth, logout, syncNow, outbox.length, needsRelogin],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress must be used inside ProgressProvider");
  return ctx;
}

export function newEventId(): string {
  // RN Hermes has crypto.randomUUID on new arch; fall back just in case
  const c = globalThis.crypto as Crypto | undefined;
  return c?.randomUUID
    ? c.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
        const r = (Math.random() * 16) | 0;
        return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });
}
