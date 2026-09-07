import type { ProgressEvent, UserProgress } from "@aral/core";
import { ApiError, type AuthTokens, type api } from "./api";
import type { LocalProgressSnapshot } from "./storage";

interface SyncOptions {
  auth: AuthTokens | null;
  api: Pick<typeof api, "sync" | "refresh" | "logout" | "updateMe">;
  timeZone: () => string;
  storage: {
    outboxAll: () => ProgressEvent[];
    saveAuth: (auth: AuthTokens) => void;
    commitSync: (progress: UserProgress, ids: string[]) => void;
    switchUser: (auth: AuthTokens | null) => LocalProgressSnapshot;
  };
  onAuth: (auth: AuthTokens | null) => void;
  onSynced: (progress: UserProgress) => void;
  onSessionChanged: (progress: LocalProgressSnapshot) => void;
  onNeedsRelogin: (needed: boolean) => void;
}

/** One network writer, with a generation that fences off every account change. */
export class ProgressSyncWorker {
  private auth: AuthTokens | null;
  private generation = 0;
  private running: Promise<void> | null = null;
  private requested = false;
  private needsRelogin = false;

  constructor(private readonly options: SyncOptions) {
    this.auth = options.auth;
  }

  private saveAuth(auth: AuthTokens): void {
    this.options.storage.saveAuth(auth);
    this.auth = auth;
    this.options.onAuth(auth);
  }

  private setNeedsRelogin(needed: boolean): void {
    this.needsRelogin = needed;
    this.options.onNeedsRelogin(needed);
  }

  adoptAuth(tokens: AuthTokens): Promise<void> {
    const progress = this.options.storage.switchUser(tokens);
    this.generation += 1;
    this.auth = tokens;
    this.options.onAuth(tokens);
    this.options.onSessionChanged(progress);
    this.setNeedsRelogin(false);
    return this.syncNow();
  }

  logout(): void {
    const previous = this.auth;
    if (!previous) return;
    const progress = this.options.storage.switchUser(null);
    this.generation += 1;
    this.auth = null;
    this.requested = false;
    this.options.onAuth(null);
    this.options.onSessionChanged(progress);
    this.setNeedsRelogin(false);
    void this.options.api.logout(previous.refreshToken).catch(() => {});
  }

  syncNow(): Promise<void> {
    if (!this.auth || this.needsRelogin) return Promise.resolve();
    this.requested = true;
    if (!this.running) {
      this.running = this.drain().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  private async drain(): Promise<void> {
    while (this.requested && this.auth && !this.needsRelogin) {
      this.requested = false;
      const generation = this.generation;
      const tokens = this.auth;
      const batch = this.options.storage.outboxAll().slice(0, 500);
      try {
        await this.push(tokens, batch, generation);
      } catch (error) {
        if (generation !== this.generation) continue;
        if (error instanceof ApiError && error.status === 401) {
          try {
            const fresh = await this.options.api.refresh(tokens.refreshToken);
            if (generation !== this.generation) continue;
            this.saveAuth(fresh);
            await this.push(fresh, batch, generation);
          } catch (refreshError) {
            if (generation !== this.generation) continue;
            if (refreshError instanceof ApiError && refreshError.status === 401) {
              this.setNeedsRelogin(true);
            }
            // Keep the outbox intact. Foreground/manual/periodic sync retries
            // transient failures; rejected refresh tokens require a login.
            this.requested = false;
            break;
          }
        } else {
          this.requested = false;
          break;
        }
      }
      if (generation !== this.generation) continue;
      this.setNeedsRelogin(false);
      // Drain every batch, including events added while a request was running.
      if (this.options.storage.outboxAll().length > 0) this.requested = true;
    }
  }

  private async push(tokens: AuthTokens, batch: ProgressEvent[], generation: number): Promise<void> {
    const tz = this.options.timeZone();
    if (tokens.user.tz !== tz) {
      try {
        const { user } = await this.options.api.updateMe(tokens.accessToken, { tz });
        if (generation !== this.generation) return;
        tokens = { ...tokens, user };
        this.saveAuth(tokens);
      } catch (error) {
        if (generation !== this.generation) return;
        if (error instanceof ApiError && error.status === 401) throw error;
        // Timezone updates are best effort while the connection is unreliable.
      }
    }
    const { progress } = await this.options.api.sync(tokens.accessToken, batch);
    if (generation !== this.generation) return;
    this.options.storage.commitSync(progress, batch.map((event) => event.id));
    this.options.onSynced(progress);
  }
}
