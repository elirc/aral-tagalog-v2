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
import { api, type AuthTokens, type AuthUser } from "./api";
import { commitSync, kvGet, kvSet, outboxAdd, outboxAll, switchUser } from "./storage";
import { ProgressSyncWorker } from "./sync-worker";

/** Progress = the last server baseline plus the durable SQLite outbox. */
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
  /** Refresh token was rejected; local progress is retained until login. */
  needsRelogin: boolean;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [outbox, setOutbox] = useState<ProgressEvent[]>(() => outboxAll());
  const [baseline, setBaseline] = useState<UserProgress | null>(() => kvGet<UserProgress>("baseline"));
  const [auth, setAuth] = useState<AuthTokens | null>(() => kvGet<AuthTokens>("auth"));
  const [needsRelogin, setNeedsRelogin] = useState(false);
  const [tick, setTick] = useState(0);
  const [worker] = useState(() => new ProgressSyncWorker({
    auth,
    api,
    timeZone: deviceTz,
    storage: {
      outboxAll,
      saveAuth: (tokens) => kvSet("auth", tokens),
      commitSync,
      switchUser,
    },
    onAuth: setAuth,
    onNeedsRelogin: setNeedsRelogin,
    onSynced: (serverProgress) => {
      setBaseline(serverProgress);
      setOutbox(outboxAll());
    },
    onSessionChanged: ({ baseline: restored, events }) => {
      setBaseline(restored);
      setOutbox(events);
    },
  }));

  const syncNow = useCallback(() => worker.syncNow(), [worker]);
  const adoptAuth = useCallback((tokens: AuthTokens) => worker.adoptAuth(tokens), [worker]);
  const logout = useCallback(() => worker.logout(), [worker]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((n) => n + 1);
      // A failed debounce used to leave events stuck until the next app launch.
      if (AppState.currentState === "active" && outboxAll().length > 0) void syncNow();
    }, 30_000);
    return () => clearInterval(timer);
  }, [syncNow]);

  const progress = useMemo(
    () => reduceEvents(outbox, deviceTz(), Date.now(), baseline ?? undefined),
    [outbox, baseline, tick],
  );

  const addEvents = useCallback((events: ProgressEvent[]) => {
    outboxAdd(events);
    setOutbox(outboxAll());
  }, []);

  useEffect(() => {
    if (!auth || outbox.length === 0) return;
    const timer = setTimeout(() => void syncNow(), 2000);
    return () => clearTimeout(timer);
  }, [auth, outbox, syncNow]);

  useEffect(() => {
    void syncNow();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncNow();
    });
    return () => subscription.remove();
  }, [syncNow]);

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
  // RN Hermes has crypto.randomUUID on new arch; fall back just in case.
  const c = globalThis.crypto as Crypto | undefined;
  return c?.randomUUID
    ? c.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
        const r = (Math.random() * 16) | 0;
        return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });
}
