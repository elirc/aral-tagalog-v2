/**
 * Shared design tokens (ARCH-02). Platform components live in each app;
 * only the raw values are shared. Web gets these as CSS variables via the
 * generated dist/tokens.css (`pnpm --filter @aral/ui build`); mobile imports
 * the objects directly.
 *
 * Contrast rules every value is held to (WCAG 2.x AA), in BOTH palettes:
 *  - a token used as TEXT: ≥4.5:1 on bg, bgMuted and the soft tints it sits on
 *    (≥3:1 only where every use is large text, ≥24px or ≥18.66px bold)
 *  - a token used as a border / focus ring / icon fill: ≥3:1 against bg/bgMuted
 *  - a fill under white text (`*Fill`): white on it ≥4.5:1
 * Ratios in the comments below are fg-on-bg / fg-on-bgMuted unless stated.
 */
export const colors = {
  primary: "#58a700", // Duolingo-ish green (decorative fills, progress bars); 3.0:1 — large text only
  primaryDark: "#3f7b00", // green as TEXT: 5.2 / 4.9, 4.7 on primarySoft + correctBg (was #4a8f00, 4.0:1)
  primaryFill: "#428000", // fill under white text — 4.9:1 (white on #4a8f00 is only 4.0:1)
  primaryDeep: "#3d7a00", // pressed/bottom edge of primary buttons
  // bright brand blue for borders, focus rings, selected states, icon fills:
  // 3.4 / 3.2, 3.1 on accentSoft (#1cb0f6 was 2.4:1 — failed even the 3:1 UI bar)
  accent: "#0a93d5",
  // blue as TEXT (links, highlighted labels): 5.3 / 4.9, 4.8 on accentSoft
  accentText: "#0a72a8",
  danger: "#d92020", // text 5.0 / 4.7; white on it 5.0 (was #ea2b2b, 4.3 / 4.0)
  warning: "#ffc800", // decorative fill only — 1.6:1 on white, never text or a white glyph's bg
  // amber readable as TEXT: 4.9 / 4.6 (was #a97e00, 3.7 / 3.5)
  warningText: "#8a6d00",
  heart: "#d61f3c", // hearts count is text: 5.1 / 4.8 (was #ff4b4b, 3.3 / 3.1)
  text: "#3c3c3c",
  // was #777 (≈4.2:1 on bgMuted, below AA for the small labels using it)
  textMuted: "#595959",
  bg: "#ffffff",
  bgMuted: "#f7f7f7",
  border: "#e5e5e5", // decorative card edges (1.3:1) — not enough alone to mark an input
  borderStrong: "#d5d5d5",
  correctBg: "#d7ffb8",
  wrongBg: "#ffdfe0",
  // soft tints for selected / earned / highlighted states
  accentSoft: "#e7f6fd",
  primarySoft: "#eef8e3",
} as const;

/** Same keys as `colors`, any value — the contract both palettes satisfy. */
export type Palette = { readonly [K in keyof typeof colors]: string };

/**
 * Dark palette. Web applies these under :root[data-theme="dark"]; mobile's
 * ThemeProvider (src/theme.tsx) swaps to it for the dark scheme. Page bg is
 * bgMuted (#14181d), cards are bg (#20262e) — the lighter of the two, so it is
 * the binding constraint for text.
 */
export const darkColors: Palette = {
  primary: "#6abe1e", // 6.5 / 7.6
  primaryDark: "#66bb10", // text role: 6.3 / 7.4, 5.1 on primarySoft (#58a700 was 4.1 there)
  primaryFill: "#3d7a00", // fill under white text — 5.3:1 (#58a700 would be 3.0:1)
  primaryDeep: "#2b5500",
  accent: "#1cb0f6", // 6.2 / 7.3, 5.0 on accentSoft
  accentText: "#1cb0f6", // the bright blue already reads as text on dark
  danger: "#f75e5e", // text 4.9 / 5.7, 4.5 on wrongBg; white glyph on it 3.1 (#ea2b2b was 3.5 on bg)
  warning: "#ffc800",
  warningText: "#e6c14a", // 8.8 / 10.3
  heart: "#ff4b4b", // 4.6 / 5.4
  text: "#e6e6e6",
  textMuted: "#b0b0b0", // 7.0 / 8.2, 4.7 on border (#a8a8a8 was 4.3 there)
  bg: "#20262e",
  bgMuted: "#14181d",
  border: "#39424d",
  borderStrong: "#4a545f",
  correctBg: "#24430e",
  wrongBg: "#4d1a1f",
  accentSoft: "#10394f",
  primarySoft: "#223b10",
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radii = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const font = {
  family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  sizeSm: 14,
  sizeMd: 17,
  sizeLg: 22,
  sizeXl: 28,
} as const;
