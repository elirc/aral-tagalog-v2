import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(project, "../../packages/content");
const output = join(project, "public/_course");
const manifest = JSON.parse(readFileSync(join(source, "dist/manifest.json"), "utf8"));
if (!/^course_en_tl_v\d+\.json$/.test(manifest.bundle)) throw new Error("Invalid content manifest");
mkdirSync(output, { recursive: true });
for (const file of ["manifest.json", manifest.bundle]) {
  copyFileSync(join(source, "dist", file), join(output, file));
}
const audio = join(source, "audio/en-tl");
if (existsSync(audio)) cpSync(audio, join(output, "audio"), { recursive: true });
console.log(`Prepared static course files: ${manifest.bundle}`);
