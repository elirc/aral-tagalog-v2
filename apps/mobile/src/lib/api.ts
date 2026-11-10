import Constants from "expo-constants";
import type { ProgressEvent, UserProgress } from "@aral/core";

export const API_URL: string =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ?? "http://localhost:3001";

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

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** RN fetch has no timeout: on a dead-but-connected network (captive portal,
 *  one bar of signal) a request can hang for minutes, leaving the auth
 *  spinner up and holding the single-flight sync lock. Aborting surfaces as a
 *  non-ApiError, i.e. "offline" to every caller. */
const DEFAULT_TIMEOUT_MS = 15_000;

async function request<T>(path: string, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers as Record<string, string>) },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  register: (email: string, password: string, tz: string) =>
    request<AuthTokens>("/auth/register", { method: "POST", body: JSON.stringify({ email, password, tz }) }),
  login: (email: string, password: string) =>
    request<AuthTokens>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  // never cut this one short: aborting after the server already rotated
  // leaves the client holding a dead token, and the retry after the 60s
  // reuse-grace window reads as token theft — family revoked, forced re-login
  refresh: (refreshToken: string) =>
    request<AuthTokens>("/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) }, 90_000),
  // plain fetch, not request(): 204 has no JSON body, and revocation is
  // best-effort — callers ignore failures rather than blocking logout
  logout: (refreshToken: string) =>
    fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).then(() => undefined),
  sync: (accessToken: string, events: ProgressEvent[]) =>
    request<{ accepted: number; rejected: string[]; progress: UserProgress }>("/sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ events }),
    }),
  updateMe: (accessToken: string, patch: { tz?: string; displayName?: string | null }) =>
    request<{ user: AuthUser }>("/me", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(patch),
    }),
  manifest: () =>
    request<{ courseId: string; version: number; bundle: string; audio: Record<string, string> }>(
      "/content/courses/en-tl/manifest",
    ),
  // the whole course: multi-MB, give a slow connection room to finish
  bundle: (name: string) => request<unknown>(`/content/bundles/${name}`, undefined, 120_000),
};

export function audioUrl(file: string): string {
  const base = file.includes("/") ? file.split("/").pop()! : file;
  return `${API_URL}/content/audio/${base}`;
}
