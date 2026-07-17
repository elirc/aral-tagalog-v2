/**
 * Shared design tokens (ARCH-02). Platform components live in each app;
 * only the raw values are shared. Web mirrors these as CSS variables in
 * globals.css — keep the two in sync when changing.
 */
export const colors = {
  primary: "#58a700", // Duolingo-ish green (decorative fills, progress bars)
  primaryDark: "#4a8f00", // green as TEXT/accent on light surfaces
  primaryFill: "#428000", // fill under white text — ≥4.5:1 (white on #4a8f00 is only 4.0:1)
  primaryDeep: "#3d7a00", // pressed/bottom edge of primary buttons
  accent: "#1cb0f6",
  danger: "#ea2b2b",
  warning: "#ffc800",
  // amber readable as TEXT on white/#f7f7f7 — #ffc800 is ~1.6:1 there
  warningText: "#a97e00",
  heart: "#ff4b4b",
  text: "#3c3c3c",
  // was #777 (≈4.2:1 on bgMuted, below AA for the small labels using it)
  textMuted: "#595959",
  bg: "#ffffff",
  bgMuted: "#f7f7f7",
  border: "#e5e5e5",
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
 * Dark palette. Web applies these under :root[data-theme="dark"]; mobile has
 * no dark mode yet, so today this is web's mirror rather than a shared consumer.
 */
export const darkColors: Palette = {
  primary: "#6abe1e",
  primaryDark: "#58a700", // text role: 5.0:1 on the dark card bg
  primaryFill: "#3d7a00", // fill under white text — 5.3:1 (#58a700 would be 3.0:1)
  primaryDeep: "#2b5500",
  accent: "#1cb0f6",
  danger: "#ea2b2b",
  warning: "#ffc800",
  warningText: "#e6c14a",
  heart: "#ff4b4b",
  text: "#e6e6e6",
  textMuted: "#a8a8a8",
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
