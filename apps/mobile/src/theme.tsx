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
      borderBottomWidth: 4,
      borderBottomColor: colors.primaryDeep,
    },
    btnPrimaryDisabled: { backgroundColor: colors.border, borderBottomColor: colors.borderStrong },
    btnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: font.sizeMd },
    btnGhost: {
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingVertical: 12,
      alignItems: "center",
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
