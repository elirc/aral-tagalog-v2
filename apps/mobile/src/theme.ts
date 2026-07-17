import { StyleSheet } from "react-native";
import { colors, font, radii, spacing } from "@aral/ui";

export { colors, font, radii, spacing };

export const styles = StyleSheet.create({
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
