"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { reduceEvents, type ProgressEvent, type UserProgress } from "@aral/core";
import { api, ApiError, type AuthTokens, type AuthUser } from "./api";
import { AUTH_KEY, authScope, ProgressStorage, type LocalProgress } from "./progress-storage";

export function deviceTz(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
  catch { return "UTC"; }
}
type SyncStatus = "idle" | "syncing" | "error";
interface ProgressContextValue {
  ready: boolean;
  progress: UserProgress;
  user: AuthUser | null;
  addEvents: (events: ProgressEvent[]) => void;
  adoptAuth: (tokens: AuthTokens) => Promise<void>;
  logout: () => void;
  syncNow: () => Promise<void>;
  pendingCount: number;
  needsRelogin: boolean;
  syncStatus: SyncStatus;
  storageError: boolean;
  rejectedCount: number;
}
const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [local, setLocal] = useState<LocalProgress>({ outbox: [], baseline: null });
  const [auth, setAuth] = useState<AuthTokens | null>(null);
  const [needsRelogin, setNeedsRelogin] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [storageError, setStorageError] = useState(false);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [tick, setTick] = useState(0);
  const storageRef = useRef<ProgressStorage | null>(null);
  const authRef = useRef<AuthTokens | null>(null);
  const generationRef = useRef(0);
  const syncingRef = useRef(false);
  const mountedRef = useRef(false);
  const syncAgainRef = useRef(false);

  const applyLocal = useCallback(() => {
    const storage = storageRef.current;
    if (storage && mountedRef.current) setLocal(storage.readProgress(authScope(authRef.current)));
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let browserStorage: Storage | null = null;
    try { browserStorage = window.localStorage; } catch { setStorageError(true); }
    const storage = new ProgressStorage(browserStorage, () => setStorageError(true));
    storageRef.current = storage;
    storage.migrateLegacy();
    authRef.current = storage.readAuth();
    setAuth(authRef.current);
    applyLocal();
    setReady(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && !event.key.startsWith("aral.")) return;
      if (event.key === AUTH_KEY || event.key === null) {
        const next = storage.readAuth();
        if (next?.user.id !== authRef.current?.user.id) {
          generationRef.current += 1;
          setRejectedCount(0);
          setSyncStatus("idle");
        }
        authRef.current = next;
        setAuth(next);
        setNeedsRelogin(false);
      }
      applyLocal();
    };
    window.addEventListener("storage", onStorage);
    const timer = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      window.removeEventListener("storage", onStorage);
      clearInterval(timer);
    };
  }, [applyLocal]);

  const progress = useMemo(
    () => reduceEvents(local.outbox, deviceTz(), Date.now(), local.baseline ?? undefined),
    [local, tick],
  );
  const addEvents = useCallback((events: ProgressEvent[]) => {
    storageRef.current?.append(authScope(authRef.current), events);
    applyLocal();
  }, [applyLocal]);

  const syncNow = useCallback(async () => {
    const storage = storageRef.current;
    const initialAuth = authRef.current;
    if (!storage || !initialAuth || !mountedRef.current) return;
    if (syncingRef.current) {
      syncAgainRef.current = true;
      return;
    }
    syncingRef.current = true;
    const generation = generationRef.current;
    const scope = authScope(initialAuth);
    const active = () => mountedRef.current && generationRef.current === generation &&
      authRef.current?.user.id === initialAuth.user.id && storage.readAuth()?.user.id === initialAuth.user.id;
    const run = async () => {
      if (!active()) return;
      setSyncStatus("syncing");
      // Read inside the cross-tab lock: another tab may have rotated the token.
      let tokens = storage.readAuth() ?? initialAuth;
      const request = async <T,>(operation: (accessToken: string) => Promise<T>): Promise<T> => {
        try { return await operation(tokens.accessToken); }
        catch (error) {
          if (!(error instanceof ApiError) || error.status !== 401 || !active()) throw error;
          const latest = storage.readAuth();
          if (latest && latest.refreshToken !== tokens.refreshToken) tokens = latest;
          else {
            try {
              const fresh = await api.refresh(tokens.refreshToken);
              if (!active()) throw new Error("Session changed");
              const current = storage.readAuth();
              tokens = current && current.refreshToken !== tokens.refreshToken ? current : fresh;
              storage.writeAuth(tokens);
              authRef.current = tokens;
              setAuth(tokens);
            } catch (refreshError) {
              const current = storage.readAuth();
              if (active() && current && current.refreshToken !== tokens.refreshToken) tokens = current;
              else {
                if (active() && refreshError instanceof ApiError && refreshError.status === 401) setNeedsRelogin(true);
                throw refreshError;
              }
            }
          }
          if (!active()) throw new Error("Session changed");
          return operation(tokens.accessToken);
        }
      };
      // Keep server and client calendar-day bucketing in agreement.
      const tz = deviceTz();
      if (tokens.user.tz !== tz) {
        const { user } = await request((accessToken) => api.updateMe(accessToken, { tz }));
        if (!active()) return;
        tokens = { ...(storage.readAuth() ?? tokens), user };
        storage.writeAuth(tokens);
        authRef.current = tokens;
        setAuth(tokens);
      }
      // An empty /sync also pulls progress. One queue avoids stale /me races.
      do {
        const batch = storage.readProgress(scope).outbox.slice(0, 500);
        const result = await request((accessToken) => api.sync(accessToken, batch));
        if (!active()) return;
        storage.settle(scope, result.progress, batch.map((event) => event.id));
        if (result.rejected.length > 0) setRejectedCount((count) => count + result.rejected.length);
        applyLocal();
      } while (active() && storage.readProgress(scope).outbox.length > 0);
      if (active()) {
        setNeedsRelogin(false);
        setSyncStatus("idle");
      }
    };
    try {
      if (navigator.locks) {
        await navigator.locks.request(`aral.sync.${scope}`, { ifAvailable: true }, async (lock) => {
          if (lock) await run();
        });
      } else await run();
    } catch {
      if (active()) setSyncStatus("error");
    } finally {
      syncingRef.current = false;
      if (syncAgainRef.current && mountedRef.current) {
        syncAgainRef.current = false;
        void syncNow();
      }
    }
  }, [applyLocal]);

  const adoptAuth = useCallback(async (tokens: AuthTokens) => {
    const storage = storageRef.current;
    if (!storage) throw new Error("Your progress is still loading. Please try again.");
    generationRef.current += 1;
    if (authRef.current === null) storage.adoptGuest(authScope(tokens));
    storage.writeAuth(tokens);
    authRef.current = tokens;
    setAuth(tokens);
    setNeedsRelogin(false);
    setRejectedCount(0);
    setSyncStatus("idle");
    applyLocal();
    await syncNow();
  }, [applyLocal, syncNow]);

  const logout = useCallback(() => {
    const tokens = authRef.current;
    generationRef.current += 1;
    authRef.current = null;
    storageRef.current?.writeAuth(null);
    setAuth(null);
    setNeedsRelogin(false);
    setSyncStatus("idle");
    setRejectedCount(0);
    // Keep unsynced lessons for the next login to this account.
    applyLocal();
    if (tokens) void api.logout(tokens.refreshToken).catch(() => {});
  }, [applyLocal]);

  useEffect(() => {
    if (!ready || !auth || needsRelogin) return;
    const timer = setTimeout(() => void syncNow(), local.outbox.length > 0 ? 1500 : 0);
    return () => clearTimeout(timer);
    // Baseline responses must not cause an endless chain of empty syncs.
  }, [ready, auth, needsRelogin, local.outbox.length, syncNow]);

  useEffect(() => {
    if (!ready) return;
    const retry = () => { if (document.visibilityState === "visible") void syncNow(); };
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    document.addEventListener("visibilitychange", retry);
    const timer = setInterval(retry, 30_000);
    return () => {
      window.removeEventListener("online", retry);
      window.removeEventListener("focus", retry);
      document.removeEventListener("visibilitychange", retry);
      clearInterval(timer);
    };
  }, [ready, syncNow]);

  const value = useMemo(() => ({
    ready, progress, user: auth?.user ?? null, addEvents, adoptAuth, logout, syncNow,
    pendingCount: local.outbox.length, needsRelogin, syncStatus, storageError, rejectedCount,
  }), [ready, progress, auth, addEvents, adoptAuth, logout, syncNow, local.outbox.length, needsRelogin, syncStatus, storageError, rejectedCount]);
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}
export function useProgress(): ProgressContextValue {
  const context = useContext(ProgressContext);
  if (!context) throw new Error("useProgress must be used inside ProgressProvider");
  return context;
}
export function newEventId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
        const r = (Math.random() * 16) | 0;
        return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });
}
