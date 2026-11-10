import type { ProgressEvent, UserProgress } from "@aral/core";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface AuthUser {
  id: string;
  email: string;
  tz: string;
  displayName: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

/**
 * A request that never settles (captive portal, a phone dropping to one bar
 * mid-flight) would hold the single-flight sync lock forever — nothing would
 * sync again until a reload. Abort instead: the rejection is a plain network
 * failure to callers, so the outbox keeps its events for the next attempt.
 */
export const REQUEST_TIMEOUT_MS = 15_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, (body as { error?: string }).error ?? res.statusText);
    }
    // awaited inside the try: the timeout also covers a stalled response body
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const api = {
  register: (email: string, password: string, tz: string) =>
    request<AuthTokens>("/auth/register", { method: "POST", body: JSON.stringify({ email, password, tz }) }),
  login: (email: string, password: string) =>
    request<AuthTokens>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  refresh: (refreshToken: string) =>
    request<AuthTokens>("/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) }),
  logout: (refreshToken: string) =>
    fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      // fire-and-forget: the page may be navigating away; keepalive lets the
      // revocation finish anyway
      keepalive: true,
    }).then(() => undefined),
  sync: (accessToken: string, events: ProgressEvent[]) =>
    request<{ accepted: number; rejected: string[]; progress: UserProgress }>("/sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ events }),
    }),
  me: (accessToken: string) =>
    request<{ user: AuthUser; progress: UserProgress }>("/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  updateMe: (accessToken: string, patch: { tz?: string; displayName?: string | null }) =>
    request<{ user: AuthUser }>("/me", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(patch),
    }),
};

export function audioUrl(fileOrRef: string): string {
  // manifest stores "audio/<ref>.mp3"; the API serves it at /content/audio/<ref>.mp3
  const file = fileOrRef.includes("/") ? fileOrRef.split("/").pop()! : `${fileOrRef}.mp3`;
  return `${API_URL}/content/audio/${file}`;
}
