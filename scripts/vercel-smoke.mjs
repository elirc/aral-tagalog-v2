import assert from "node:assert/strict";

const base = process.env.SMOKE_WEB_URL ?? "http://localhost:3000";
const request = (path, init = {}) => fetch(new URL(path, base), {
  signal: AbortSignal.timeout(30_000), ...init,
});
let checks = 0;
function check(name, condition) { assert.ok(condition, name); console.log(`  ✓ ${name}`); checks++; }

const page = await request("/");
check("web page responds", page.status === 200);
check("web pages reject framing", page.headers.get("x-frame-options") === "DENY");
await page.body?.cancel();
const ready = await request("/api/ready");
check("embedded API is ready", ready.status === 200 && (await ready.json()).ok === true);
check("private API responses are not cached", ready.headers.get("cache-control") === "no-store");
const manifestRedirect = await request("/api/content/courses/en-tl/manifest", { redirect: "manual" });
check("manifest uses static assets", manifestRedirect.status === 307 && manifestRedirect.headers.get("location") === "/_course/manifest.json");
const manifestResponse = await request("/api/content/courses/en-tl/manifest");
check("manifest can be downloaded", manifestResponse.status === 200);
const manifest = await manifestResponse.json();
const bundleRedirect = await request(`/api/content/bundles/${manifest.bundle}`, { redirect: "manual" });
check("large course downloads bypass the function response", bundleRedirect.status === 307 &&
  bundleRedirect.headers.get("location") === `/_course/${manifest.bundle}`);
const bundleResponse = await request(`/api/content/bundles/${manifest.bundle}`);
check("versioned static content is immutable", /immutable/.test(bundleResponse.headers.get("cache-control") ?? ""));
const bundle = await bundleResponse.json();
check("downloaded course matches the manifest", bundle.id === "en-tl" && bundle.version === manifest.version);
check("all four course sections are present", bundle.tiers.length === 4 && bundle.units.length >= 2850);
const anonymous = await request("/api/me");
check("private routes still require authentication", anonymous.status === 401);
const bad = await request("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
check("invalid JSON is rejected by the original API parser", bad.status === 400);
const oversized = await request("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ padding: "x".repeat(1_048_577) }) });
check("embedded API enforces upload limits", oversized.status === 413);
console.log(`${checks}/${checks} Vercel-path checks passed`);
