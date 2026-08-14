/**
 * Merge newly-authored vocab entries into course/en-tl/vocab.yaml.
 *
 *   node scripts/merge-vocab.mjs new-vocab.json
 *
 * Input: JSON array of { id, lemma, translation, notes?, from? }.
 * Skips entries whose id OR lemma (case-insensitively) already exists, so
 * re-running is safe and authors proposing an existing word can't create a
 * duplicate (the compiler builds vocab as a keyed map — a collision would
 * silently drop one entry).
 *
 * Appends in file order with the same formatting the file already uses, and
 * prints a report of added vs skipped.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const vocabPath = resolve(here, "..", "packages", "content", "course", "en-tl", "vocab.yaml");

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("usage: node scripts/merge-vocab.mjs <new-vocab.json>");
  process.exit(1);
}

const incoming = JSON.parse(readFileSync(inputPath, "utf8"));
const raw = readFileSync(vocabPath, "utf8");

// The file is a flat YAML list of "- id: x" blocks; parse just enough to
// dedupe without a YAML dependency in this script.
const existingIds = new Set([...raw.matchAll(/^- id:\s*(.+)$/gm)].map((m) => m[1].trim()));
const existingLemmas = new Set(
  [...raw.matchAll(/^\s+lemma:\s*(.+)$/gm)].map((m) => m[1].trim().replace(/^["']|["']$/g, "").toLowerCase()),
);

const quote = (s) => {
  const v = String(s);
  // quote when YAML would otherwise misparse (leading/trailing space, or a
  // value containing : # " ' or starting with a special indicator)
  return /^[\s]|[\s]$|[:#"'{}[\],&*?|<>=!%@`]|^$/.test(v) ? JSON.stringify(v) : v;
};

const added = [];
const skipped = [];
const seenThisRun = new Set();

for (const entry of incoming) {
  const id = String(entry.id ?? "").trim();
  const lemma = String(entry.lemma ?? "").trim();
  const translation = String(entry.translation ?? "").trim();
  if (!id || !lemma || !translation) {
    skipped.push({ id: id || "(no id)", why: "missing id/lemma/translation" });
    continue;
  }
  const lemmaKey = lemma.toLowerCase();
  if (existingIds.has(id)) {
    skipped.push({ id, why: "id already in vocab.yaml" });
    continue;
  }
  if (existingLemmas.has(lemmaKey)) {
    skipped.push({ id, why: `lemma "${lemma}" already in vocab.yaml` });
    continue;
  }
  if (seenThisRun.has(id) || seenThisRun.has(lemmaKey)) {
    skipped.push({ id, why: "duplicate within this batch" });
    continue;
  }
  seenThisRun.add(id);
  seenThisRun.add(lemmaKey);
  existingIds.add(id);
  existingLemmas.add(lemmaKey);
  added.push({ id, lemma, translation, notes: entry.notes?.trim() || undefined });
}

if (added.length > 0) {
  const block = added
    .map((v) => {
      const lines = [`- id: ${quote(v.id)}`, `  lemma: ${quote(v.lemma)}`, `  translation: ${quote(v.translation)}`];
      if (v.notes) lines.push(`  notes: ${quote(v.notes)}`);
      return lines.join("\n");
    })
    .join("\n");
  const body = raw.endsWith("\n") ? raw : `${raw}\n`;
  writeFileSync(vocabPath, `${body}${block}\n`);
}

console.log(`added ${added.length}, skipped ${skipped.length}`);
for (const s of skipped) console.log(`  - ${s.id}: ${s.why}`);
