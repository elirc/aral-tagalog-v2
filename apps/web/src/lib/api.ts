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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (body as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
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
  sync: (accessToken: string, events: ProgressEvent[]) =>
    request<{ accepted: number; progress: UserProgress }>("/sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ events }),
    }),
  me: (accessToken: string) =>
    request<{ user: AuthUser; progress: UserProgress }>("/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
};

export function audioUrl(fileOrRef: string): string {
  // manifest stores "audio/<ref>.mp3"; the API serves it at /content/audio/<ref>.mp3
  const file = fileOrRef.includes("/") ? fileOrRef.split("/").pop()! : `${fileOrRef}.mp3`;
  return `${API_URL}/content/audio/${file}`;
}
