import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, SectionList, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { VocabEntry } from "@aral/core";
import { playAudio } from "@/lib/audio";
import { getBundle } from "@/lib/content";
import { font, radii, spacing, useTheme } from "@/theme";

/**
 * Phrasebook: every vocab entry in the course, searchable, with audio.
 * Pure content view — no progress writes, works logged out. Mirrors the
 * web app's /words page.
 */
export default function WordsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, styles, mode } = useTheme();
  const [query, setQuery] = useState("");
  // deep link / cold start lands here with nothing to pop back to
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const all = useMemo(
    () =>
      Object.values(getBundle().vocab).sort((a, b) =>
        a.lemma.localeCompare(b.lemma, "fil", { sensitivity: "base" }),
      ),
    [],
  );

  const q = query.trim().toLowerCase();
  const sections = useMemo(() => {
    if (q) {
      const hits = all.filter(
        (v) =>
          v.lemma.toLowerCase().includes(q) ||
          v.translation.toLowerCase().includes(q) ||
          (v.notes ?? "").toLowerCase().includes(q),
      );
      // no sections at all when nothing matches, so ListEmptyComponent shows
      return hits.length > 0 ? [{ title: "", data: hits }] : [];
    }
    // group by first letter for scannability (search results stay flat)
    const by = new Map<string, VocabEntry[]>();
    for (const v of all) {
      const letter = (v.lemma[0] ?? "#").toUpperCase();
      if (!by.has(letter)) by.set(letter, []);
      by.get(letter)!.push(v);
    }
    return [...by.entries()].map(([title, data]) => ({ title, data }));
  }, [q, all]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs, flexDirection: "column", alignItems: "stretch" }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            style={({ pressed }) => [styles.iconBtn, { marginLeft: -spacing.sm }, pressed && styles.pressed]}
          >
            <Text style={{ fontSize: 22, color: colors.text }}>←</Text>
          </Pressable>
          <Text style={styles.subtitle} accessibilityRole="header">
            Phrasebook
          </Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.muted}>{all.length} words</Text>
        </View>
        {/* pinned under the header (not a list header) so search stays
            reachable after scrolling deep into the alphabet */}
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search Tagalog or English…"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Search words"
          autoCorrect={false}
          autoCapitalize="none"
          autoComplete="off"
          returnKeyType="search"
          // iOS: follow the app theme, which can differ from the system's
          keyboardAppearance={mode}
          selectionColor={colors.accent}
          clearButtonMode="while-editing"
          style={[styles.input, { paddingVertical: 10, minHeight: 44 }]}
        />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(v) => v.id}
        stickySectionHeadersEnabled
        // tap a row (play audio) without first dismissing the keyboard;
        // dragging the list puts the keyboard away
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl + insets.bottom }}
        ListEmptyComponent={
          <Text style={[styles.muted, { textAlign: "center", marginTop: spacing.lg }]}>
            No matches for “{query}”.
          </Text>
        }
        renderSectionHeader={({ section }) =>
          section.title ? (
            <Text
              accessibilityRole="header"
              style={{
                fontSize: font.sizeSm,
                fontWeight: "800",
                color: colors.textMuted,
                backgroundColor: colors.bgMuted,
                paddingVertical: spacing.xs,
              }}
            >
              {section.title}
            </Text>
          ) : null
        }
        renderItem={({ item }) => <WordRow entry={item} />}
      />
    </View>
  );
}

function WordRow({ entry }: { entry: VocabEntry }) {
  const { colors, styles } = useTheme();
  // the whole card plays the word: a 30pt speaker glyph alone was too small
  // a target, and "tap the word to hear it" is what a phrasebook invites
  return (
    <Pressable
      onPress={() => void playAudio(entry.audio, entry.lemma)}
      accessibilityRole="button"
      accessibilityLabel={`${entry.lemma}, ${entry.translation}`}
      accessibilityHint="Plays the pronunciation"
      style={({ pressed }) => [
        styles.card,
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          padding: spacing.sm,
          marginBottom: spacing.sm,
        },
        pressed && { backgroundColor: colors.accentSoft, borderColor: colors.accent },
      ]}
    >
      <View style={[styles.iconBtn, { backgroundColor: colors.accentSoft, borderRadius: radii.pill }]}>
        <Text style={{ fontSize: 20 }}>🔊</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.body, { fontWeight: "700" }]}>{entry.lemma}</Text>
        <Text style={styles.muted}>{entry.translation}</Text>
        {entry.notes ? (
          <Text style={[styles.muted, { fontSize: font.sizeSm - 1, marginTop: 2 }]}>{entry.notes}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
