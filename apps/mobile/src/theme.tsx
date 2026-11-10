import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { StyleSheet, useColorScheme } from "react-native";
import { colors as lightColors, darkColors, font, radii, spacing, type Palette } from "@aral/ui";
import { kvGet, kvSet } from "@/lib/storage";

export { font, radii, spacing, type Palette };

/** Label color on an `accent` fill. Only dark text clears contrast on either
 *  accent blue (light #0a93d5 ≈6.2:1, dark #1cb0f6 ≈8.6:1; white fails both).
 *  Set explicitly: RN's default Text color turns light under Android's
 *  DayNight theme in dark mode. */
export const ON_ACCENT = "#000";

/** Cap for glyphs that sit in fixed-size boxes (icons, badges, discs): at the
 *  largest accessibility sizes they'd overflow the box without helping
 *  legibility. Reading text keeps full scaling. */
export const ICON_MAX_SCALE = 1.3;

export type ThemeMode = "light" | "dark";

/** kv key for the explicit preference; absent = follow the system scheme. */
const THEME_KEY = "theme";

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bgMuted },
    container: { padding: spacing.md, gap: spacing.md },
    card: {
      backgroundColor: colors.bg,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: spacing.md,
    },
    title: { fontSize: font.sizeXl, fontWeight: "800", color: colors.text },
    subtitle: { fontSize: font.sizeLg, fontWeight: "800", color: colors.text },
    body: { fontSize: font.sizeMd, color: colors.text },
    muted: { fontSize: font.sizeSm, color: colors.textMuted },
    prompt: { fontSize: font.sizeLg, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
    btnPrimary: {
      // primaryFill is the only green ≥4.5:1 under this white label
      backgroundColor: colors.primaryFill,
      borderRadius: radii.md,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      // 44pt floor for compact variants that override paddingVertical
      minHeight: 44,
      borderBottomWidth: 4,
      borderBottomColor: colors.primaryDeep,
    },
    btnPrimaryDisabled: { backgroundColor: colors.border, borderBottomColor: colors.borderStrong },
    btnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: font.sizeMd },
    // white on the light-mode disabled fill (#e5e5e5) is ~1.3:1 — invisible
    btnPrimaryTextDisabled: { color: colors.textMuted },
    btnGhost: {
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
    },
    btnGhostText: { color: colors.textMuted, fontWeight: "700" },
    optionBtn: {
      backgroundColor: colors.bg,
      borderWidth: 2,
      borderBottomWidth: 4,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
    },
    optionSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
    optionText: { fontSize: font.sizeMd, fontWeight: "600", color: colors.text },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    /** Merge into each chip inside a chipRow: RN children don't shrink by
     *  default, so one long word at a large font size would run past the card
     *  edge instead of wrapping inside its chip. */
    chip: { maxWidth: "100%" },
    /** Top bar of a screen; callers add `paddingTop: insets.top + spacing.sm`
     *  so the bar's own background runs up under the status bar. */
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
      backgroundColor: colors.bg,
      borderBottomWidth: 2,
      borderBottomColor: colors.border,
      gap: spacing.sm,
    },
    /** Square 44pt tap target for an icon/emoji-only button. */
    iconBtn: {
      minWidth: 44,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.md,
    },
    /** Merge into a Pressable's style function: `({ pressed }) => [.., pressed && styles.pressed]` */
    pressed: { opacity: 0.6 },
    input: {
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      minHeight: 48,
      fontSize: font.sizeMd,
      backgroundColor: colors.bg,
      color: colors.text,
    },
  });
}

export type AppStyles = ReturnType<typeof makeStyles>;

interface ThemeValue {
  colors: Palette;
  styles: AppStyles;
  mode: ThemeMode;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  // explicit preference wins; absent = follow the device scheme
  const [pref, setPref] = useState<ThemeMode | null>(() => kvGet<ThemeMode>(THEME_KEY));
  const mode: ThemeMode = pref ?? (system === "dark" ? "dark" : "light");

  const toggle = useCallback(() => {
    const next: ThemeMode = mode === "dark" ? "light" : "dark";
    kvSet(THEME_KEY, next);
    setPref(next);
  }, [mode]);

  const palette = mode === "dark" ? darkColors : lightColors;
  const value = useMemo<ThemeValue>(
    () => ({ colors: palette, styles: makeStyles(palette), mode, toggle }),
    [palette, mode, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
