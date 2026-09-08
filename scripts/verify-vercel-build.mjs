import { stat } from "node:fs/promises";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const web = resolve(root, "apps/web");
const traceFile = resolve(web, ".next/server/pages/api/[[...path]].js.nft.json");
const trace = JSON.parse(readFileSync(traceFile, "utf8"));
const files = new Set(trace.files.map((file) => resolve(dirname(traceFile), file)));
const manifestFile = resolve(web, "public/_course/manifest.json");
const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
assert(files.has(manifestFile), "Vercel API trace must include the course manifest");
assert(files.has(resolve(web, "public/_course/sync_catalog.json")), "Vercel API trace must include the compact reward catalog");
const fullCourseFiles = [...files].filter((file) => /^course_.*\.json$/i.test(basename(file)));
assert(fullCourseFiles.length === 0, "Full course JSON must stay out of the API trace: " + fullCourseFiles.slice(0, 3).join(", "));
for (const directory of ["web", "audio"]) {
  const staticDirectory = resolve(web, "public/_course", directory) + sep;
  assert([...files].every((file) => !file.startsWith(staticDirectory)), "Static " + directory + " assets must stay out of the API trace");
}
assert(existsSync(resolve(web, "public/_course", manifest.bundle)), "Native full-course updates must remain available as static assets");
assert([...files].some((file) => /argon2.*\.node$/.test(file)), "Vercel API must include native password hashing");
// Bound filesystem concurrency while sizing larger function traces.
const tracedFiles = [...files];
let bytes = 0;
for (let offset = 0; offset < tracedFiles.length; offset += 32) {
  const sizes = await Promise.all(tracedFiles.slice(offset, offset + 32).map(async (file) => {
    try {
      return (await stat(file)).size;
    } catch (error) {
      if (error?.code === "ENOENT") return 0;
      throw error;
    }
  }));
  bytes += sizes.reduce((sum, size) => sum + size, 0);
}
assert(bytes < 250 * 1024 * 1024, "Vercel function trace exceeds the 250 MB uncompressed limit");
console.log(`Verified Vercel API trace: ${(bytes / 1024 / 1024).toFixed(1)} MB, content and password hashing included.`);

// A full curriculum import once made every learning route ship 26 MB of JS.
const appManifest = JSON.parse(readFileSync(resolve(web, ".next/app-build-manifest.json"), "utf8"));
for (const route of ["/page", "/words/page", "/stats/page", "/lesson/[lessonId]/page"]) {
  const chunks = new Set([...(appManifest.pages["/layout"] ?? []), ...(appManifest.pages[route] ?? [])]);
  assert(appManifest.pages[route], "Missing app route build manifest: " + route);
  const initialJs = [...chunks].filter((file) => file.endsWith(".js")).reduce((sum, file) => sum + statSync(resolve(web, ".next", file)).size, 0);
  assert(initialJs < 3 * 1024 * 1024, "Initial route JavaScript exceeds the 3 MB loading budget: " + route);
  console.log("Verified initial JS budget " + route + ": " + (initialJs / 1024 / 1024).toFixed(2) + " MB");
}
