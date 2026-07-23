import { describe, expect, it } from "vitest";
import { tzSchema } from "./auth";

// tz is stored and fed to Intl by every progress derivation; a bad zone
// would 500 that user's /me and /sync forever — so the schema must be strict
describe("tzSchema", () => {
  it("accepts real IANA timezones", () => {
    expect(tzSchema.safeParse("Asia/Manila").success).toBe(true);
    expect(tzSchema.safeParse("UTC").success).toBe(true);
  });

  it("rejects made-up zones", () => {
    expect(tzSchema.safeParse("Mars/Phobos").success).toBe(false);
  });

  it("rejects the empty string", () => {
    expect(tzSchema.safeParse("").success).toBe(false);
  });

  it("rejects strings over 64 characters before consulting Intl", () => {
    expect(tzSchema.safeParse("A".repeat(65)).success).toBe(false);
  });
});
