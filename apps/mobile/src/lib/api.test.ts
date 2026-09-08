import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: { apiUrl: "https://api.example.com" } } } }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("mobile API requests", () => {
  it("aborts an unresponsive API and releases the caller", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: string, options: RequestInit) => new Promise((_, reject) => {
      options.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    })));
    const request = api.login("person@example.com", "password");
    const assertion = expect(request).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("handles logout's empty 204 response", async () => {
    const response = { ok: true, status: 204, json: vi.fn() };
    vi.stubGlobal("fetch", vi.fn(async () => response));
    await expect(api.logout("refresh-token")).resolves.toBeUndefined();
    expect(response.json).not.toHaveBeenCalled();
  });

  it("preserves API status codes needed for refresh and relogin", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: "Expired" }) })));
    await expect(api.refresh("revoked-token")).rejects.toMatchObject({ status: 401, message: "Expired" });
  });
});
