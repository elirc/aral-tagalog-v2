/**
 * Apply reviewer-proposed content edits to the course YAML.
 *
 *   node scripts/apply-content-edits.mjs edits.json [--dry]
 *
 * Input: JSON array of { file, where, current, proposed, kind }.
 * Each edit is a literal replacement of `current` with `proposed`, so this is
 * deterministic and auditable — no model judgement at apply time.
 *
 * Safety rules (an edit that trips any of them is skipped and reported):
 *  - `current` must appear EXACTLY once in the file (no ambiguous targets)
 *  - `proposed` is re-indented to match `current`'s indentation, since
 *    reviewers quote snippets with inconsistent leading whitespace
 *  - already-applied edits (current absent, proposed present) are no-ops
 *
 * Structural correctness is verified afterwards by `pnpm content:build`,
 * whose validator rejects unspellable word banks, answers duplicated among
 * distractors, and fill-blank options that lost their answer.
 */
import { readFileSync, writeFileSync } from "node:fs";

const input = process.argv[2];
const dry = process.argv.includes("--dry");
if (!input) {
  console.error("usage: node scripts/apply-content-edits.mjs <edits.json> [--dry]");
  process.exit(1);
}

const edits = JSON.parse(readFileSync(input, "utf8"));
const cache = new Map();
const read = (f) => {
  if (!cache.has(f)) cache.set(f, readFileSync(f, "utf8"));
  return cache.get(f);
};

const indentOf = (block) => {
  const first = block.split("\n").find((l) => l.trim().length > 0) ?? "";
  return first.match(/^\s*/)[0];
};

/** Shift every line of `block` so its first line sits at `target` indentation. */
function reindent(block, target) {
  const from = indentOf(block);
  if (from === target) return block;
  const lines = block.split("\n");
  if (from.length > target.length) {
    const strip = from.length - target.length;
    return lines.map((l) => (l.startsWith(" ".repeat(strip)) ? l.slice(strip) : l)).join("\n");
  }
  const pad = " ".repeat(target.length - from.length);
  return lines.map((l) => (l.trim().length > 0 ? pad + l : l)).join("\n");
}

let applied = 0;
const already = [];
const skipped = [];

for (const e of edits) {
  const label = `${e.slug ?? e.file.split("/").pop()} — ${e.where}`;
  const text = read(e.file);
  const current = e.current.replace(/\r\n/g, "\n");
  const occurrences = text.split(current).length - 1;

  if (occurrences === 0) {
    const proposedRaw = e.proposed.replace(/\r\n/g, "\n");
    if (text.includes(reindent(proposedRaw, indentOf(proposedRaw)).trim())) already.push(label);
    else skipped.push(`${label}: 'current' text not found`);
    continue;
  }
  if (occurrences > 1) {
    skipped.push(`${label}: 'current' matches ${occurrences} places (ambiguous)`);
    continue;
  }

  const proposed = reindent(e.proposed.replace(/\r\n/g, "\n"), indentOf(current));
  cache.set(e.file, text.replace(current, proposed));
  applied++;
}

if (!dry) for (const [f, text] of cache) writeFileSync(f, text);

console.log(`${dry ? "[dry run] " : ""}applied ${applied}, already-applied ${already.length}, skipped ${skipped.length}`);
for (const s of already) console.log(`  = ${s}`);
for (const s of skipped) console.log(`  ! ${s}`);
