import * as SQLite from "expo-sqlite";
import type { ProgressEvent, UserProgress } from "@aral/core";
import type { AuthTokens } from "./api";

/**
 * Device persistence (OFF-01/OFF-02):
 *  - kv: active auth, progress baseline, account progress archives, cached bundle
 *  - outbox: progress events awaiting sync, flushed by the sync worker
 */
const db = SQLite.openDatabaseSync("aral.db");

db.execSync(`
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS outbox (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

export function kvGet<T>(key: string): T | null {
  const row = db.getFirstSync<{ value: string }>("SELECT value FROM kv WHERE key = ?", key);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export function kvSet(key: string, value: unknown): void {
  if (value === null || value === undefined) {
    db.runSync("DELETE FROM kv WHERE key = ?", key);
  } else {
    db.runSync(
      "INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      key,
      JSON.stringify(value),
    );
  }
}

function insertEvents(events: ProgressEvent[]): void {
  for (const ev of events) {
    db.runSync(
      "INSERT OR IGNORE INTO outbox (id, payload, created_at) VALUES (?, ?, ?)",
      ev.id,
      JSON.stringify(ev),
      Date.now(),
    );
  }
}

export function outboxAdd(events: ProgressEvent[]): void {
  db.withTransactionSync(() => insertEvents(events));
}

export function outboxAll(): ProgressEvent[] {
  return db
    .getAllSync<{ payload: string }>("SELECT payload FROM outbox ORDER BY created_at")
    .map((r) => JSON.parse(r.payload) as ProgressEvent);
}

export function outboxClear(ids: string[]): void {
  db.withTransactionSync(() => {
    for (const id of ids) db.runSync("DELETE FROM outbox WHERE id = ?", id);
  });
}

/** A crash must never leave acknowledged events overlaid on their new baseline. */
export function commitSync(progress: UserProgress, ids: string[]): void {
  db.withTransactionSync(() => {
    kvSet("baseline", progress);
    for (const id of ids) db.runSync("DELETE FROM outbox WHERE id = ?", id);
  });
}

export interface LocalProgressSnapshot {
  baseline: UserProgress | null;
  events: ProgressEvent[];
}

function activeProgress(): LocalProgressSnapshot {
  return { baseline: kvGet<UserProgress>("baseline"), events: outboxAll() };
}

/**
 * Switching accounts must hide the previous account's progress without losing
 * offline work. Archives contain progress only; logout removes the active tokens.
 * Guest events join the account explicitly chosen at login, never another archive.
 */
export function switchUser(nextAuth: AuthTokens | null): LocalProgressSnapshot {
  db.withTransactionSync(() => {
    const previousAuth = kvGet<AuthTokens>("auth");
    if (previousAuth?.user.id === nextAuth?.user.id) {
      kvSet("auth", nextAuth);
      return;
    }

    const guestEvents = previousAuth ? [] : outboxAll();
    if (previousAuth) kvSet(`account-progress:${previousAuth.user.id}`, activeProgress());

    const archiveKey = nextAuth ? `account-progress:${nextAuth.user.id}` : null;
    const restored = archiveKey ? kvGet<LocalProgressSnapshot>(archiveKey) : null;
    kvSet("auth", nextAuth);
    kvSet("baseline", restored?.baseline ?? null);
    db.execSync("DELETE FROM outbox");
    insertEvents([...(restored?.events ?? []), ...guestEvents]);
    if (archiveKey) kvSet(archiveKey, null);
  });
  return activeProgress();
}
