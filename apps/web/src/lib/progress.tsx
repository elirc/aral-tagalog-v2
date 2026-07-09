"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { reduceEvents, type ProgressEvent, type UserProgress } from "@aral/core";
import { api, ApiError, type AuthTokens, type AuthUser } from "./api";

/**
 * Progress store: works logged-out (guest) with everything in localStorage,
 * and logged-in by overlaying the unsynced outbox on the server baseline.
 * The same event-sourced model the mobile app uses with SQLite (OFF-02).
 */

const KEYS = { outbox: "aral.outbox", baseline: "aral.baseline", auth: "aral.auth" };

function load<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function save(key: string, value: unknown) {
  if (value === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, JSON.stringify(value));
}

export function deviceTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

interface ProgressContextValue {
  ready: boolean;
  progress: UserProgress;
  user: AuthUser | null;
  addEvents: (events: ProgressEvent[]) => void;
  /** register or login result -> adopt tokens, push outbox, pull baseline */
  adoptAuth: (tokens: AuthTokens) => Promise<void>;
  logout: () => void;
  syncNow: () => Promise<void>;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [outbox, setOutbox] = useState<ProgressEvent[]>([]);
  const [baseline, setBaseline] = useState<UserProgress | null>(null);
  const [auth, setAuth] = useState<AuthTokens | null>(null);
  const [tick, setTick] = useState(0); // re-derive hearts as time passes

  useEffect(() => {
    setOutbox(load<ProgressEvent[]>(KEYS.outbox) ?? []);
    setBaseline(load<UserProgress>(KEYS.baseline));
    setAuth(load<AuthTokens>(KEYS.auth));
    setReady(true);
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const progress = useMemo(
    () => reduceEvents(outbox, deviceTz(), Date.now(), baseline ?? undefined),
    [outbox, baseline, tick],
  );

  const addEvents = useCallback((events: ProgressEvent[]) => {
    setOutbox((prev) => {
      const next = [...prev, ...events];
      save(KEYS.outbox, next);
      return next;
    });
  }, []);

  const syncWith = useCallback(async (tokens: AuthTokens, events: ProgressEvent[]) => {
    try {
      const { progress: serverProgress } = await api.sync(tokens.accessToken, events);
      setBaseline(serverProgress);
      save(KEYS.baseline, serverProgress);
      setOutbox([]);
      save(KEYS.outbox, []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // access token expired: rotate via refresh token, retry once
        const fresh = await api.refresh(tokens.refreshToken);
        setAuth(fresh);
        save(KEYS.auth, fresh);
        const { progress: serverProgress } = await api.sync(fresh.accessToken, events);
        setBaseline(serverProgress);
        save(KEYS.baseline, serverProgress);
        setOutbox([]);
        save(KEYS.outbox, []);
      } else {
        throw err; // offline or server down — outbox stays, retried next time
      }
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (!auth) return;
    await syncWith(auth, outbox).catch(() => {});
  }, [auth, outbox, syncWith]);

  const adoptAuth = useCallback(
    async (tokens: AuthTokens) => {
      setAuth(tokens);
      save(KEYS.auth, tokens);
      // push guest progress made before signup, then adopt server truth
      await syncWith(tokens, outbox).catch(() => {});
    },
    [outbox, syncWith],
  );

  const logout = useCallback(() => {
    setAuth(null);
    setBaseline(null);
    setOutbox([]);
    save(KEYS.auth, null);
    save(KEYS.baseline, null);
    save(KEYS.outbox, []);
  }, []);

  // background sync: whenever the outbox has items and we're logged in
  useEffect(() => {
    if (!ready || !auth || outbox.length === 0) return;
    const t = setTimeout(() => void syncNow(), 1500);
    return () => clearTimeout(t);
  }, [ready, auth, outbox, syncNow]);

  const value = useMemo(
    () => ({ ready, progress, user: auth?.user ?? null, addEvents, adoptAuth, logout, syncNow }),
    [ready, progress, auth, addEvents, adoptAuth, logout, syncNow],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress must be used inside ProgressProvider");
  return ctx;
}

export function newEventId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
