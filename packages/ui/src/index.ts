/**
 * Shared design tokens (ARCH-02). Platform components live in each app;
 * only the raw values are shared. Web mirrors these as CSS variables in
 * globals.css — keep the two in sync when changing.
 */
export const colors = {
  primary: "#58a700", // Duolingo-ish green
  primaryDark: "#4a8f00",
  accent: "#1cb0f6",
  danger: "#ea2b2b",
  warning: "#ffc800",
  heart: "#ff4b4b",
  text: "#3c3c3c",
  textMuted: "#777777",
  bg: "#ffffff",
  bgMuted: "#f7f7f7",
  border: "#e5e5e5",
  correctBg: "#d7ffb8",
  wrongBg: "#ffdfe0",
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radii = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const font = {
  family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  sizeSm: 14,
  sizeMd: 17,
  sizeLg: 22,
  sizeXl: 28,
} as const;
