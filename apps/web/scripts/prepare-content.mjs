import { copyFile } from "node:fs/promises";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(project, "../../packages/content");
const output = join(project, "public/_course");
const manifest = JSON.parse(readFileSync(join(source, "dist/manifest.json"), "utf8"));
if (!/^course_en_tl_v\d+\.json$/.test(manifest.bundle)) throw new Error("Invalid content manifest");
mkdirSync(output, { recursive: true });
for (const file of ["manifest.json", "sync_catalog.json", manifest.bundle]) {
  copyFileSync(join(source, "dist", file), join(output, file));
}
const webIndex = JSON.parse(readFileSync(join(source, "dist/web/index.json"), "utf8"));
const webOutput = join(output, "web");
mkdirSync(webOutput, { recursive: true });
const webFiles = [...webIndex.units.map((unit) => unit.file), webIndex.vocabFile, ...webIndex.reviewFiles];
const uniqueWebFiles = [...new Set(webFiles)];
for (let offset = 0; offset < uniqueWebFiles.length; offset += 32) {
  await Promise.all(uniqueWebFiles.slice(offset, offset + 32).map((file) => {
    if (!/^(unit|vocab|review)-[a-f0-9]{20}\.json$/.test(file)) throw new Error("Invalid web content file");
    return copyFile(join(source, "dist/web", file), join(webOutput, file));
  }));
}
const audio = join(source, "audio/en-tl");
if (existsSync(audio)) cpSync(audio, join(output, "audio"), { recursive: true });
console.log(`Prepared static course files: ${manifest.bundle}`);
