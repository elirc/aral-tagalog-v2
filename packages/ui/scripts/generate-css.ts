import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { colors, darkColors, type Palette } from "../src/index";

/**
 * Emits dist/tokens.css from the shared design tokens so the web app and the
 * token source can never drift (they used to be hand-mirrored). camelCase
 * token keys become kebab-case custom properties: primaryFill -> --primary-fill.
 * Rationale for individual values (contrast targets etc.) lives in src/index.ts.
 */

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function block(selector: string, palette: Palette): string {
  const lines = Object.entries(palette).map(([key, value]) => `  --${kebab(key)}: ${value};`);
  return `${selector} {\n${lines.join("\n")}\n}`;
}

const css = `/* GENERATED from @aral/ui src/index.ts — do not edit, run the ui build. */
${block(":root", colors)}

/* data-theme is stamped on <html> before first paint (web layout.tsx) */
${block(':root[data-theme="dark"]', darkColors)}
`;

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "tokens.css"), css);
console.log(`✓ wrote ${join(outDir, "tokens.css")}`);
