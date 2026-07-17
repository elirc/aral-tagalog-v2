import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [outbox, setOutbox] = useState<ProgressEvent[]>(() => outboxAll());
  const [baseline, setBaseline] = useState<UserProgress | null>(() => kvGet<UserProgress>("baseline"));
  const [auth, setAuth] = useState<AuthTokens | null>(() => kvGet<AuthTokens>("auth"));
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
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        const fresh = await api.refresh(tokens.refreshToken);
        kvSet("auth", fresh);
        setAuth(fresh);
        await push(fresh);
      } else {
        throw err; // offline — outbox stays for the next attempt (OFF-02)
      }
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (!auth) return;
    await syncWith(auth, outboxAll()).catch(() => {});
  }, [auth, syncWith]);

  const adoptAuth = useCallback(
    async (tokens: AuthTokens) => {
      kvSet("auth", tokens);
      setAuth(tokens);
      await syncWith(tokens, outboxAll()).catch(() => {});
    },
    [syncWith],
  );

  const logout = useCallback(() => {
    wipeAll();
    setAuth(null);
    setBaseline(null);
    setOutbox([]);
  }, []);

  // sync worker: on new events (debounced) and when the app foregrounds
  useEffect(() => {
    if (!auth || outbox.length === 0) return;
    const t = setTimeout(() => void syncNow(), 2000);
    return () => clearTimeout(t);
  }, [auth, outbox, syncNow]);

  useEffect(() => {
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
    }),
    [progress, auth, addEvents, adoptAuth, logout, syncNow, outbox.length],
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
