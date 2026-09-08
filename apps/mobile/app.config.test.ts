import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const configure = createRequire(import.meta.url)("./app.config.js") as (input: { config: Record<string, unknown> }) => {
  extra: { apiUrl: string };
};

afterEach(() => vi.unstubAllEnvs());

describe("mobile release API configuration", () => {
  it("defaults to localhost only for local development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("EAS_BUILD_PROFILE", "");
    vi.stubEnv("EXPO_PUBLIC_API_URL", "");
    expect(configure({ config: {} }).extra.apiUrl).toBe("http://localhost:3001");
  });

  it("rejects missing API configuration in release builds", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EXPO_PUBLIC_API_URL", "");
    expect(() => configure({ config: {} })).toThrow("Set EXPO_PUBLIC_API_URL");
  });

  it.each(["http://api.example.com", "https://localhost", "https://127.0.0.1", "https://[::1]"])(
    "rejects unsafe release URL %s", (url) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("EXPO_PUBLIC_API_URL", url);
      expect(() => configure({ config: {} })).toThrow("deployed HTTPS");
    },
  );

  it("also guards internal EAS preview builds", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("EAS_BUILD_PROFILE", "preview");
    vi.stubEnv("EXPO_PUBLIC_API_URL", "http://localhost:3001");
    expect(() => configure({ config: {} })).toThrow("deployed HTTPS");
  });

  it("embeds and normalizes the supplied production API URL", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EXPO_PUBLIC_API_URL", "https://api.example.com/");
    expect(configure({ config: { extra: { feature: true } } }).extra).toEqual({
      apiUrl: "https://api.example.com", feature: true,
    });
  });
});
