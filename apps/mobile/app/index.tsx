import { Link, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { displayStreak, localDayKey, MAX_HEARTS, regenerate } from "@aral/core";
import { getBundle } from "@/lib/content";
import { deviceTz, useProgress } from "@/lib/progress";
import { colors, spacing, styles } from "@/theme";

export default function CourseMapScreen() {
  const router = useRouter();
  const { progress, user, logout, pendingCount } = useProgress();
  const bundle = getBundle();
  const done = new Set(progress.completedLessonIds);
  const now = Date.now();
  const hearts = regenerate(progress.hearts, now).hearts;
  const streak = displayStreak(progress.streak, localDayKey(now, deviceTz()));

  let nextFound = false;

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
        <Text style={{ fontSize: 22, fontWeight: "800", color: colors.primary }}>Aral</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontWeight: "700" }}>🔥 {streak}</Text>
        <Text style={{ fontWeight: "700", color: colors.warning }}>⚡ {progress.xpTotal}</Text>
        <Text style={{ fontWeight: "700", color: colors.heart }}>
          ❤️ {hearts}/{MAX_HEARTS}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {!user && (
          <Text style={styles.muted}>
            Playing as guest — <Link href="/register" style={{ color: colors.accent }}>create an account</Link> to
            back up progress.
          </Text>
        )}
        {user && pendingCount > 0 && (
          <Text style={styles.muted}>{pendingCount} change(s) waiting to sync…</Text>
        )}

        {bundle.units.map((unit, ui) => (
          <View key={unit.id} style={styles.card}>
            <Text style={styles.subtitle}>
              Unit {ui + 1}: {unit.title}
            </Text>
            {unit.description ? <Text style={[styles.muted, { marginBottom: spacing.sm }]}>{unit.description}</Text> : null}
            {unit.lessons.map((lesson) => {
              const isDone = done.has(lesson.id);
              const isNext = !isDone && !nextFound;
              if (isNext) nextFound = true;
              const locked = !isDone && !isNext;
              return (
                <View
                  key={lesson.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    paddingVertical: spacing.sm,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isDone ? colors.warning : isNext ? colors.primary : colors.border,
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "800" }}>{isDone ? "★" : isNext ? "▶" : "🔒"}</Text>
                  </View>
                  <Text style={[styles.body, { fontWeight: "600", flex: 1 }]}>{lesson.title}</Text>
                  {!locked && (
                    <Pressable
                      style={[styles.btnPrimary, { paddingVertical: 8, paddingHorizontal: 16 }]}
                      onPress={() => router.push(`/lesson/${lesson.id}`)}
                    >
                      <Text style={styles.btnPrimaryText}>{isDone ? "Practice" : "Start"}</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        ))}

        {user ? (
          <Pressable style={styles.btnGhost} onPress={logout}>
            <Text style={styles.btnGhostText}>Log out ({user.email})</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.btnGhost} onPress={() => router.push("/login")}>
            <Text style={styles.btnGhostText}>Log in</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
