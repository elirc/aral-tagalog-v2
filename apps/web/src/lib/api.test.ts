import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("API requests", () => {
  it("bounds hanging requests so sync and login can be retried", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })));
    const result = expect(api.login("user@example.com", "password")).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(15_000);
    await result;
  });

  it("preserves HTTP status codes so auth can distinguish expiry from a server outage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })));
    await expect(api.sync("expired", [])).rejects.toMatchObject({ status: 401, message: "Unauthorized" });
  });

  it("provides a usable connection error instead of exposing fetch internals", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(api.login("user@example.com", "password")).rejects.toThrow("Check your connection");
  });

  it("accepts an empty successful logout response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(api.logout("refresh")).resolves.toBeUndefined();
  });
});
