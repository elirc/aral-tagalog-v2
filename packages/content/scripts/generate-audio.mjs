#!/usr/bin/env node
/**
 * Build-time TTS fallback (AUD-02): fills in audio clips that haven't been
 * recorded yet, using Piper (https://github.com/rhasspy/piper) locally.
 * No runtime/API cost — generated files are committed like recordings.
 *
 * Usage:
 *   1. pnpm --filter @aral/content build      (produces dist/audio_texts.json)
 *   2. Install piper + a Filipino/Tagalog voice model (e.g. tl_PH if available,
 *      or record clips yourself — recorded clips always win).
 *   3. node scripts/generate-audio.mjs --model /path/to/voice.onnx
 *
 * Writes audio/en-tl/<ref>.wav then converts to .mp3 with ffmpeg if present.
 * Skips refs that already have an .mp3 (your recordings take priority, AUD-01).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const texts = JSON.parse(readFileSync(join(root, "dist", "audio_texts.json"), "utf8"));
const outDir = join(root, "audio", "en-tl");
mkdirSync(outDir, { recursive: true });

const modelIdx = process.argv.indexOf("--model");
const model = modelIdx > -1 ? process.argv[modelIdx + 1] : null;
if (!model) {
  console.error("Usage: node scripts/generate-audio.mjs --model /path/to/piper-voice.onnx");
  process.exit(1);
}

let generated = 0;
let skipped = 0;
for (const [ref, text] of Object.entries(texts)) {
  const mp3 = join(outDir, `${ref}.mp3`);
  if (existsSync(mp3)) { skipped++; continue; }
  if (!text) { console.warn(`no text known for ref "${ref}" — record it manually`); continue; }
  const wav = join(outDir, `${ref}.wav`);
  execFileSync("piper", ["--model", model, "--output_file", wav], { input: text });
  try {
    execFileSync("ffmpeg", ["-y", "-i", wav, "-b:a", "64k", mp3]);
    rmSync(wav);
  } catch {
    console.warn("ffmpeg not found — keeping .wav (update manifest paths accordingly)");
  }
  generated++;
}
console.log(`generated ${generated}, skipped ${skipped} existing`);
