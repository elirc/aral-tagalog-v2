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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers as Record<string, string>) },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
    }
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  } catch (error) {
    if (controller.signal.aborted) throw new Error("The request timed out. Please try again.");
    throw error;
  } finally {
    clearTimeout(timeout);
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
    request<void>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),
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
  bundle: (name: string) => request<unknown>(`/content/bundles/${name}`),
};

export function audioUrl(file: string): string {
  const base = file.includes("/") ? file.split("/").pop()! : file;
  return `${API_URL}/content/audio/${base}`;
}
