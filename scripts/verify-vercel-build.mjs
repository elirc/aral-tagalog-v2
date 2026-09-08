import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
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
assert(files.has(resolve(web, "public/_course", manifest.bundle)), "Vercel API trace must include the current course");
assert([...files].some((file) => /argon2.*\.node$/.test(file)), "Vercel API must include native password hashing");
const bytes = [...files].reduce((sum, file) => sum + (existsSync(file) ? statSync(file).size : 0), 0);
assert(bytes < 250 * 1024 * 1024, "Vercel function trace exceeds the 250 MB uncompressed limit");
console.log(`Verified Vercel API trace: ${(bytes / 1024 / 1024).toFixed(1)} MB, content and password hashing included.`);
