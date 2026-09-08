/** Read-only checks through the public HTTPS entrypoint. Run after `pnpm smoke`:
 * SMOKE_WEB_URL=https://aral.example.com node scripts/proxy-smoke.mjs
 * For an isolated local CA, use NODE_EXTRA_CA_CERTS; never disable TLS validation.
 */
import assert from "node:assert/strict";

const base = new URL(process.env.SMOKE_WEB_URL ?? "https://localhost:8443");
assert.equal(base.protocol, "https:", "SMOKE_WEB_URL must use HTTPS");
assert.notEqual(process.env.NODE_TLS_REJECT_UNAUTHORIZED, "0", "TLS validation must remain enabled");
const httpUrl = process.env.SMOKE_HTTP_URL ?? `http://${base.hostname}`;
let checks = 0;
function check(name, condition) {
  assert.ok(condition, name);
  checks += 1;
  console.log(`  ✓ ${name}`);
}
const request = (path, init = {}) => fetch(new URL(path, base), {
  signal: AbortSignal.timeout(15_000), ...init,
});

console.log(`proxy smoke: ${base.origin}`);
const redirect = await fetch(httpUrl, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
check("HTTP redirects to the HTTPS origin", [301, 308].includes(redirect.status) &&
  new URL(redirect.headers.get("location"), httpUrl).origin === base.origin);

const page = await request("/");
check("HTTPS certificate is valid and the web app responds", page.status === 200);
check("HTTPS responses enable HSTS", /max-age=[1-9]\d*/.test(page.headers.get("strict-transport-security") ?? ""));
check("web pages reject framing", page.headers.get("x-frame-options") === "DENY");
check("web pages disable content sniffing", page.headers.get("x-content-type-options") === "nosniff");
const html = await page.text();
const assetPath = html.match(/src="([^"]*\/_next\/static\/[^"?]+\.js[^" ]*)"/)?.[1];
check("web page includes built JavaScript", Boolean(assetPath));
const asset = await request(assetPath);
check("built JavaScript is served through the proxy", asset.status === 200 &&
  /javascript/.test(asset.headers.get("content-type") ?? ""));
await asset.body?.cancel();

const ready = await request("/api/ready");
check("API readiness works with the /api prefix", ready.status === 200 && (await ready.json()).ok === true);
check("readiness responses cannot be cached", ready.headers.get("cache-control") === "no-store");
const anonymous = await request("/api/me");
check("private routes require authentication through the proxy", anonymous.status === 401);
check("private responses cannot be cached", anonymous.headers.get("cache-control") === "no-store");
const allowed = await request("/api/health", { headers: { Origin: base.origin } });
check("the browser origin is allowed by CORS", allowed.headers.get("access-control-allow-origin") === base.origin);
const disallowed = await request("/api/health", { headers: { Origin: "https://untrusted.invalid" } });
check("other origins receive no CORS permission", !disallowed.headers.has("access-control-allow-origin"));

const manifest = await request("/api/content/courses/en-tl/manifest");
check("course manifest is available through HTTPS", manifest.status === 200);
const { bundle } = await manifest.json();
const content = await request(`/api/content/bundles/${encodeURIComponent(bundle)}`, {
  headers: { "Accept-Encoding": "gzip" },
});
check("course bundles are compressed", content.status === 200 && content.headers.get("content-encoding") === "gzip");
check("versioned course bundles use immutable caching", /immutable/.test(content.headers.get("cache-control") ?? ""));
check("compressed bundles remain valid JSON", (await content.json()).id === "en-tl");
const traversal = await request("/api/content/audio/..%2F..%2Fprivate.mp3");
check("encoded path traversal is rejected", traversal.status === 400);
const missing = await request("/missing-release-check-page");
check("unknown web routes return 404", missing.status === 404);

// Invalid input cannot write an account; it exercises the request-size limit
// at the public entrypoint before a body reaches application validation.
const oversized = await request("/api/auth/login", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ padding: "x".repeat(1_048_577) }),
});
check(`oversized request bodies return 413 (received ${oversized.status})`, oversized.status === 413);

// A client can omit Content-Length. The actual streamed byte count must still
// be limited, and a rejected upload must not break the next ordinary request.
const streamed = await request("/api/auth/login", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: (async function* () {
    yield '{"padding":"';
    for (let chunk = 0; chunk < 17; chunk++) yield "x".repeat(65_536);
    yield '"}';
  })(),
  duplex: "half",
});
check(`oversized chunked bodies return 413 (received ${streamed.status})`, streamed.status === 413);
const afterUpload = await request("/api/ready");
check("the API remains ready after rejected uploads", afterUpload.status === 200);
console.log(`${checks}/${checks} proxy checks passed`);
