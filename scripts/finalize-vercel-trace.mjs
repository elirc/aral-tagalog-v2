import { readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const web = resolve(root, "apps/web");
const staticRoot = resolve(web, "public/_course");
const traceFile = resolve(web, ".next/server/pages/api/[[...path]].js.nft.json");
const traceDirectory = dirname(traceFile);

// Next 15.5.25 resolves exclusion globs with path.join but does not normalize
// Windows backslashes before picomatch, so its intended exclusions do not match.
// The embedded API redirects these public assets to static delivery before
// Fastify handles a request. Keep this narrow finalization step on every build;
// the independent verifier still rejects any unexpected full bundle elsewhere.
function isPublicCourseAsset(file) {
  const local = relative(staticRoot, resolve(traceDirectory, file));
  if (!local || isAbsolute(local) || local === ".." || local.startsWith(".." + sep)) return false;
  const parts = local.split(sep);
  return (parts.length > 1 && (parts[0] === "web" || parts[0] === "audio")) ||
    (parts.length === 1 && /^course_.*\.json$/.test(parts[0]));
}

// A missing or malformed trace is a build error, never a silent no-op.
const trace = JSON.parse(await readFile(traceFile, "utf8"));
if (!trace || !Array.isArray(trace.files) || !trace.files.every((file) => typeof file === "string")) {
  throw new Error("Invalid Vercel API trace: expected a files array of paths");
}
const excluded = trace.files.filter(isPublicCourseAsset);
let excludedBytes = 0;
for (let offset = 0; offset < excluded.length; offset += 32) {
  const sizes = await Promise.all(excluded.slice(offset, offset + 32).map(async (file) => {
    const asset = resolve(traceDirectory, file);
    const info = await stat(asset);
    if (!info.isFile()) throw new Error("Excluded static asset is not a file: " + asset);
    return info.size;
  }));
  excludedBytes += sizes.reduce((sum, size) => sum + size, 0);
}
const retained = trace.files.filter((file) => !isPublicCourseAsset(file));
if (excluded.length > 0) {
  // Preserve the completed trace if a write is interrupted before replacement.
  const temporary = traceFile + ".finalizing";
  await writeFile(temporary, JSON.stringify({ ...trace, files: retained }));
  await rename(temporary, traceFile);
}
console.log("Finalized Vercel API trace: excluded " + excluded.length + " static assets (" +
  (excludedBytes / 1024 / 1024).toFixed(1) + " MiB); retained " + retained.length + " entries.");
