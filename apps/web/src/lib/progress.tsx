"use client";

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
  /** unsynced events waiting in the outbox (0 when everything is saved) */
  pendingCount: number;
  /** refresh token was rejected: still "logged in" locally but nothing syncs */
  needsRelogin: boolean;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [outbox, setOutbox] = useState<ProgressEvent[]>([]);
  const [baseline, setBaseline] = useState<UserProgress | null>(null);
  const [auth, setAuth] = useState<AuthTokens | null>(null);
  const [needsRelogin, setNeedsRelogin] = useState(false);
  const [tick, setTick] = useState(0); // re-derive hearts as time passes
  const outboxRef = useRef<ProgressEvent[]>([]);
  const hydratedRef = useRef(false);

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
    // the server caps batches at 500; leftovers flush on the next debounce
    const batch = events.slice(0, 500);
    const push = async (t: AuthTokens) => {
      const { progress: serverProgress } = await api.sync(t.accessToken, batch);
      setBaseline(serverProgress);
      save(KEYS.baseline, serverProgress);
      // a 200 resolves every sent event (accepted or rejected) — remove only
      // those ids, never events appended while this request was in flight
      const sent = new Set(batch.map((e) => e.id));
      setOutbox((prev) => {
        const next = prev.filter((e) => !sent.has(e.id));
        save(KEYS.outbox, next);
        return next;
      });
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
        setAuth(fresh);
        save(KEYS.auth, fresh);
        await push(fresh);
        setNeedsRelogin(false);
      } else {
        throw err; // offline or server down — outbox stays, retried next time
      }
    }
  }, []);

  // One /sync at a time. Two overlapping syncs both hit 401 on an expired
  // access token and both present the same refresh token (the server treats
  // the loser as a benign race, but the second sync's older server snapshot
  // could still overwrite the newer baseline and lose events).
  const syncingRef = useRef(false);
  const syncNow = useCallback(async () => {
    if (!auth || syncingRef.current) return;
    syncingRef.current = true;
    try {
      await syncWith(auth, outbox);
    } catch {
      // offline or server down — the outbox keeps the events for next time
    } finally {
      syncingRef.current = false;
    }
  }, [auth, outbox, syncWith]);

  const adoptAuth = useCallback(
    async (tokens: AuthTokens) => {
      // Logging in as a *different* account (e.g. after a session expired)
      // must not push the previous user's unsynced events into the new one.
      // Coming from guest (auth === null) still carries over, which is the
      // whole point of guest mode.
      const switchingUser = auth !== null && auth.user.id !== tokens.user.id;
      if (switchingUser) {
        setOutbox([]);
        save(KEYS.outbox, []);
        setBaseline(null);
        save(KEYS.baseline, null);
        hydratedRef.current = false;
      }
      setAuth(tokens);
      setNeedsRelogin(false);
      save(KEYS.auth, tokens);
      // push guest progress made before signup, then adopt server truth
      await syncWith(tokens, switchingUser ? [] : outbox).catch(() => {});
    },
    [auth, outbox, syncWith],
  );

  const logout = useCallback(() => {
    // best-effort server-side revocation of this device's refresh-token family
    if (auth) void api.logout(auth.refreshToken).catch(() => {});
    hydratedRef.current = false;
    setNeedsRelogin(false);
    setAuth(null);
    setBaseline(null);
    setOutbox([]);
    save(KEYS.auth, null);
    save(KEYS.baseline, null);
    save(KEYS.outbox, []);
  }, [auth]);

  // background sync: whenever the outbox has items and we're logged in
  useEffect(() => {
    if (!ready || !auth || outbox.length === 0) return;
    const t = setTimeout(() => void syncNow(), 1500);
    return () => clearTimeout(t);
  }, [ready, auth, outbox, syncNow]);

  // Pull server truth once on load. The sync effect above only fires when the
  // outbox has items, so without this a device with nothing to push never sees
  // progress made on other devices.
  outboxRef.current = outbox;
  useEffect(() => {
    if (!ready || !auth || hydratedRef.current) return;
    hydratedRef.current = true;
    if (outbox.length > 0) return; // /sync's response will refresh the baseline
    const apply = (serverProgress: UserProgress) => {
      // a completion may have landed while this request was in flight; the
      // pending sync's response is fresher than ours, so let it win
      if (outboxRef.current.length > 0) return;
      setBaseline(serverProgress);
      save(KEYS.baseline, serverProgress);
    };
    api
      .me(auth.accessToken)
      .then(({ progress: serverProgress }) => apply(serverProgress))
      .catch(async (err) => {
        if (!(err instanceof ApiError && err.status === 401)) return; // offline — keep local state
        try {
          const fresh = await api.refresh(auth.refreshToken);
          setAuth(fresh);
          save(KEYS.auth, fresh);
          apply((await api.me(fresh.accessToken)).progress);
        } catch (refreshErr) {
          if (refreshErr instanceof ApiError && refreshErr.status === 401) setNeedsRelogin(true);
        }
      });
  }, [ready, auth, outbox]);

  // keep the server-side tz current: the server buckets streak/xpByDay days
  // with users.tz, clients with the device zone — they must agree (GAM-02)
  useEffect(() => {
    if (!ready || !auth) return;
    const tz = deviceTz();
    if (auth.user.tz === tz) return;
    api
      .updateMe(auth.accessToken, { tz })
      .then(({ user }) => {
        const next = { ...auth, user };
        setAuth(next);
        save(KEYS.auth, next);
      })
      .catch(() => {}); // best-effort; retried after the next token refresh
  }, [ready, auth]);

  const value = useMemo(
    () => ({
      ready,
      progress,
      user: auth?.user ?? null,
      addEvents,
      adoptAuth,
      logout,
      syncNow,
      pendingCount: outbox.length,
      needsRelogin,
    }),
    [ready, progress, auth, addEvents, adoptAuth, logout, syncNow, outbox.length, needsRelogin],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress must be used inside ProgressProvider");
  return ctx;
}

export function newEventId(): string {
  // crypto.randomUUID needs a secure context (plain-http LAN hosts lack it);
  // the fallback must still be a well-formed v4 UUID — /sync rejects anything
  // else, and one bad id would poison the outbox
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
        const r = (Math.random() * 16) | 0;
        return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });
}
