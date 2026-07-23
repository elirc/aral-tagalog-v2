import { Link, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  buildReviewLesson,
  displayStreak,
  levelForXp,
  localDayKey,
  MAX_HEARTS,
  PRACTICE_XP,
  regenerate,
} from "@aral/core";
import { getBundle } from "@/lib/content";
import { deviceTz, useProgress } from "@/lib/progress";
import { radii, spacing, useTheme } from "@/theme";

export default function CourseMapScreen() {
  const router = useRouter();
  const { colors, styles, toggle } = useTheme();
  const { progress, user, logout, pendingCount, needsRelogin } = useProgress();
  const bundle = getBundle();
  const done = new Set(progress.completedLessonIds);
  const now = Date.now();
  const hearts = regenerate(progress.hearts, now).hearts;
  const streak = displayStreak(progress.streak, localDayKey(now, deviceTz()));
  const level = levelForXp(progress.xpTotal);
  // count only mistakes whose exercises still exist in this bundle version
  const reviewable =
    buildReviewLesson(bundle.units, progress.weakExerciseIds, Number.MAX_SAFE_INTEGER)?.exercises
      .length ?? 0;

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
        <View
          style={{
            backgroundColor: colors.primaryFill,
            borderRadius: radii.pill,
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>Lv {level}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Text style={{ fontWeight: "700", color: colors.text }}>🔥 {streak}</Text>
        <Text style={{ fontWeight: "700", color: colors.warningText }}>⚡ {progress.xpTotal}</Text>
        <Text style={{ fontWeight: "700", color: colors.heart }}>
          ❤️ {hearts}/{MAX_HEARTS}
        </Text>
        <Pressable onPress={() => router.push("/words")} accessibilityLabel="open phrasebook">
          <Text style={{ fontSize: 20 }}>📖</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/stats")} accessibilityLabel="view stats">
          <Text style={{ fontSize: 20 }}>📊</Text>
        </Pressable>
        <Pressable onPress={toggle} accessibilityLabel="toggle dark mode">
          <Text style={{ fontSize: 20 }}>🌓</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {!user && (
          <Text style={styles.muted}>
            Playing as guest — <Link href="/register" style={{ color: colors.accent }}>create an account</Link> to
            back up progress.
          </Text>
        )}
        {user && needsRelogin && (
          <Pressable onPress={() => router.push("/login")}>
            <Text style={[styles.muted, { color: colors.danger, fontWeight: "700" }]}>
              Session expired — tap to log in again. Progress stays on this device until you do.
            </Text>
          </Pressable>
        )}
        {user && pendingCount > 0 && (
          <Text style={styles.muted}>{pendingCount} change(s) waiting to sync…</Text>
        )}

        {reviewable > 0 && (
          <Pressable
            style={[styles.card, { flexDirection: "row", alignItems: "center", gap: spacing.sm }]}
            onPress={() => router.push("/lesson/review")}
            accessibilityLabel="review your mistakes"
          >
            <Text style={{ fontSize: 28 }}>🧹</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.body, { fontWeight: "800" }]}>Review your mistakes</Text>
              <Text style={styles.muted}>
                {reviewable} exercise{reviewable > 1 ? "s" : ""} to practice · +{PRACTICE_XP} XP · +1 ❤️
              </Text>
            </View>
            <View style={[styles.btnPrimary, { paddingVertical: 8, paddingHorizontal: 16 }]}>
              <Text style={styles.btnPrimaryText}>Review</Text>
            </View>
          </Pressable>
        )}

        {bundle.units.map((unit, ui) => (
          <View key={unit.id} style={styles.card}>
            <Text style={styles.subtitle}>
              Unit {ui + 1}: {unit.title}
            </Text>
            {unit.description ? <Text style={[styles.muted, { marginBottom: spacing.sm }]}>{unit.description}</Text> : null}
            {unit.tip ? (
              <View
                style={{
                  flexDirection: "row",
                  gap: spacing.sm,
                  backgroundColor: colors.accentSoft,
                  borderRadius: radii.md,
                  padding: spacing.sm,
                  marginBottom: spacing.sm,
                }}
              >
                <Text>💡</Text>
                <Text style={[styles.muted, { flex: 1, color: colors.text }]}>{unit.tip}</Text>
              </View>
            ) : null}
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
                      backgroundColor: isDone ? colors.warning : isNext ? colors.primaryFill : colors.border,
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
