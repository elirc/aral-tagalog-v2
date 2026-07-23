import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, SectionList, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  const { colors, styles } = useTheme();
  const [query, setQuery] = useState("");

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
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: colors.bg,
          borderBottomWidth: 2,
          borderBottomColor: colors.border,
          gap: spacing.md,
        }}
      >
        <Pressable onPress={() => router.back()} accessibilityLabel="back">
          <Text style={{ fontSize: 20, color: colors.text }}>←</Text>
        </Pressable>
        <Text style={styles.subtitle}>Phrasebook</Text>
        <View style={{ flex: 1 }} />
        <Text style={styles.muted}>{all.length} words</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(v) => v.id}
        stickySectionHeadersEnabled
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
        ListHeaderComponent={
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search Tagalog or English…"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Search words"
            autoCorrect={false}
            style={{
              backgroundColor: colors.bg,
              borderWidth: 2,
              borderColor: colors.border,
              borderRadius: radii.md,
              paddingHorizontal: spacing.md,
              paddingVertical: 10,
              fontSize: font.sizeMd,
              color: colors.text,
              marginBottom: spacing.sm,
            }}
          />
        }
        ListEmptyComponent={
          <Text style={[styles.muted, { textAlign: "center", marginTop: spacing.lg }]}>
            No matches for “{query}”.
          </Text>
        }
        renderSectionHeader={({ section }) =>
          section.title ? (
            <Text
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
    </SafeAreaView>
  );
}

function WordRow({ entry }: { entry: VocabEntry }) {
  const { styles } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          padding: spacing.sm,
          marginBottom: spacing.sm,
        },
      ]}
    >
      <Pressable
        onPress={() => void playAudio(entry.audio, entry.lemma)}
        accessibilityLabel={`play audio for ${entry.lemma}`}
        style={{ padding: spacing.xs }}
      >
        <Text style={{ fontSize: 20 }}>🔊</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={[styles.body, { fontWeight: "700" }]}>{entry.lemma}</Text>
        <Text style={styles.muted}>{entry.translation}</Text>
        {entry.notes ? (
          <Text style={[styles.muted, { fontSize: font.sizeSm - 1, marginTop: 2 }]}>{entry.notes}</Text>
        ) : null}
      </View>
    </View>
  );
}
