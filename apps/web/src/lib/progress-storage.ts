import { reduceEvents, type ProgressEvent, type UserProgress } from "@aral/core";
import type { AuthTokens } from "./api";

export const AUTH_KEY = "aral.auth";
const PREFIX = "aral.progress.v2.";
export const GUEST_SCOPE = "guest";

export interface LocalProgress {
  outbox: ProgressEvent[];
  baseline: UserProgress | null;
}

interface Snapshot {
  progress: UserProgress | null;
  settled: string[];
}

function isEvent(value: unknown): value is ProgressEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as ProgressEvent;
  if (typeof event.id !== "string" || !Number.isSafeInteger(event.occurredAt) || event.occurredAt < 0) return false;
  switch (event.type) {
    case "lesson_completed":
      return typeof event.lessonId === "string" && Number.isFinite(event.xp) &&
        typeof event.perfect === "boolean" &&
        [event.missedExerciseIds, event.masteredExerciseIds].every(
          (ids) => ids === undefined || (Array.isArray(ids) && ids.every((id) => typeof id === "string")),
        );
    case "hearts_lost": return Number.isFinite(event.count);
    case "hearts_refilled": return event.amount === "full" || Number.isFinite(event.amount);
    case "goal_set": return Number.isFinite(event.goalXp);
    case "tier_started": return typeof event.tierId === "string";
    default: return false;
  }
}

export function authScope(auth: AuthTokens | null): string {
  return auth ? `user:${auth.user.id}` : GUEST_SCOPE;
}

/** One key per event prevents two tabs from overwriting each other's outbox.
 * Account journals survive logout, so offline progress resumes on the next login.
 */
export class ProgressStorage {
  private memory = new Map<string, string>();
  private failed = false;

  constructor(private storage: Storage | null, private onFailure: () => void = () => {}) {}

  private unavailable() {
    if (!this.failed) this.onFailure();
    this.failed = true;
  }

  private keys(): string[] {
    if (!this.failed && this.storage) {
      try {
        const keys: string[] = [];
        for (let i = 0; i < this.storage.length; i++) {
          const key = this.storage.key(i);
          if (key?.startsWith("aral.")) keys.push(key);
        }
        return keys;
      } catch { this.unavailable(); }
    }
    return [...this.memory.keys()];
  }

  private read(key: string): unknown {
    let raw = this.memory.get(key) ?? null;
    if (!this.failed && this.storage) {
      try {
        raw = this.storage.getItem(key);
        if (raw === null) this.memory.delete(key);
        else this.memory.set(key, raw);
      } catch { this.unavailable(); }
    }
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  private write(key: string, value: unknown) {
    const raw = value === null ? null : JSON.stringify(value);
    if (raw === null) this.memory.delete(key);
    else this.memory.set(key, raw);
    if (!this.failed && this.storage) {
      try {
        if (raw === null) this.storage.removeItem(key);
        else this.storage.setItem(key, raw);
        return;
      } catch { this.unavailable(); }
    } else if (!this.storage) this.unavailable();
  }

  readAuth(): AuthTokens | null {
    const auth = this.read(AUTH_KEY) as AuthTokens | null;
    return auth && typeof auth.accessToken === "string" && typeof auth.refreshToken === "string" &&
      typeof auth.user?.id === "string" && typeof auth.user.email === "string" && typeof auth.user.tz === "string"
      ? auth : null;
  }

  writeAuth(auth: AuthTokens | null) { this.write(AUTH_KEY, auth); }

  private prefix(scope: string) { return `${PREFIX}${encodeURIComponent(scope)}.`; }
  private snapshotKey(scope: string) { return `${this.prefix(scope)}snapshot`; }
  private eventKey(scope: string, id: string) { return `${this.prefix(scope)}event.${id}`; }

  private snapshot(scope: string): Snapshot {
    const value = this.read(this.snapshotKey(scope)) as Snapshot | null;
    if (!value || !Array.isArray(value.settled)) return { progress: null, settled: [] };
    try {
      const progress = value.progress ? reduceEvents([], "UTC", Date.now(), value.progress) : null;
      return { progress, settled: value.settled.filter((id) => typeof id === "string") };
    } catch { return { progress: null, settled: [] }; }
  }

  readProgress(scope: string): LocalProgress {
    const snapshot = this.snapshot(scope);
    const settled = new Set(snapshot.settled);
    const eventPrefix = `${this.prefix(scope)}event.`;
    const outbox: ProgressEvent[] = [];
    for (const key of this.keys()) {
      if (!key.startsWith(eventPrefix)) continue;
      const event = this.read(key);
      if (isEvent(event) && !settled.has(event.id)) outbox.push(event);
    }
    outbox.sort((a, b) => a.occurredAt - b.occurredAt || a.id.localeCompare(b.id));
    return { outbox, baseline: snapshot.progress };
  }

  append(scope: string, events: ProgressEvent[]) {
    for (const event of events) this.write(this.eventKey(scope, event.id), event);
  }

  settle(scope: string, progress: UserProgress, ids: string[]) {
    // Persist the baseline and acknowledgments atomically BEFORE deleting events.
    // A closed tab or quota error between writes must not count the batch twice.
    const settled = [...new Set([...this.snapshot(scope).settled, ...ids])].filter(
      (id) => ids.includes(id) || this.read(this.eventKey(scope, id)) !== null,
    );
    this.write(this.snapshotKey(scope), { progress, settled });
    for (const id of settled) this.write(this.eventKey(scope, id), null);
  }

  adoptGuest(scope: string) {
    const guest = this.readProgress(GUEST_SCOPE).outbox;
    this.append(scope, guest);
    for (const event of guest) this.write(this.eventKey(GUEST_SCOPE, event.id), null);
  }

  migrateLegacy() {
    const scope = authScope(this.readAuth());
    const outbox = this.read("aral.outbox");
    const baseline = this.read("aral.baseline") as UserProgress | null;
    if (Array.isArray(outbox)) this.append(scope, outbox.filter(isEvent));
    if (baseline && this.read(this.snapshotKey(scope)) === null) {
      this.write(this.snapshotKey(scope), { progress: baseline, settled: [] });
    }
    this.write("aral.outbox", null);
    this.write("aral.baseline", null);
  }
}
