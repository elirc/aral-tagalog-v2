import { useCallback, useMemo, useState } from "react";
import { Link, useRouter } from "expo-router";
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  buildReviewLesson,
  displayStreak,
  levelForXp,
  localDayKey,
  MAX_HEARTS,
  PRACTICE_XP,
  regenerate,
  type Unit,
} from "@aral/core";
import { getBundle } from "@/lib/content";
import { deviceTz, useProgress } from "@/lib/progress";
import { radii, spacing, useTheme } from "@/theme";

export default function CourseMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, styles, toggle, mode } = useTheme();
  const { progress, user, logout, pendingCount, needsRelogin, syncNow } = useProgress();
  const [refreshing, setRefreshing] = useState(false);
  const bundle = getBundle();
  const done = useMemo(() => new Set(progress.completedLessonIds), [progress.completedLessonIds]);
  const now = Date.now();
  const hearts = regenerate(progress.hearts, now).hearts;
  const streak = displayStreak(progress.streak, localDayKey(now, deviceTz()));
  const level = levelForXp(progress.xpTotal);
  // count only mistakes whose exercises still exist in this bundle version
  const reviewable =
    buildReviewLesson(bundle.units, progress.weakExerciseIds, Number.MAX_SAFE_INTEGER)?.exercises
      .length ?? 0;

  // The first uncompleted lesson in course order. Computed up front rather
  // than tracked with a flag while rendering: the list is virtualized, so
  // unit cards do not render in order (or at all, until scrolled to).
  const next = useMemo(() => {
    for (let ui = 0; ui < bundle.units.length; ui++) {
      const unit = bundle.units[ui]!;
      const lesson = unit.lessons.find((l) => !done.has(l.id));
      if (lesson) return { unit, lesson, unitIndex: ui };
    }
    return null;
  }, [bundle.units, done]);

  // Pull-to-refresh = "fetch my progress from other devices now". Only
  // meaningful when signed in; syncNow is single-flight and swallows
  // offline errors, so this always settles.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncNow();
    } finally {
      setRefreshing(false);
    }
  }, [syncNow]);

  // logout wipes this device's data, including anything not yet synced
  const confirmLogout = () => {
    Alert.alert(
      "Log out?",
      pendingCount > 0
        ? `${pendingCount} change(s) haven't synced yet and will be lost from this device.`
        : "Your progress is saved to your account.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Log out", style: "destructive", onPress: logout },
      ],
    );
  };

  const renderUnit = ({ item: unit, index: ui }: { item: Unit; index: number }) => (
    <View style={styles.card}>
      <Text style={styles.subtitle} accessibilityRole="header">
        Unit {ui + 1}: {unit.title}
      </Text>
      {unit.description ? (
        <Text style={[styles.muted, { marginBottom: spacing.sm }]}>{unit.description}</Text>
      ) : null}
      {unit.tip ? (
        <View
          accessible
          accessibilityLabel={`Tip: ${unit.tip}`}
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
        const isNext = lesson.id === next?.lesson.id;
        const locked = !isDone && !isNext;
        const action = isDone ? "Practice" : "Start";
        const rowStyle = {
          flexDirection: "row" as const,
          alignItems: "center" as const,
          gap: spacing.sm,
          paddingVertical: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        };
        const badge = (
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
        );
        const title = (
          <Text style={[styles.body, { fontWeight: "600", flex: 1 }]} numberOfLines={2}>
            {lesson.title}
          </Text>
        );
        if (locked) {
          return (
            <View key={lesson.id} style={rowStyle} accessible accessibilityLabel={`${lesson.title}, locked`}>
              {badge}
              {title}
            </View>
          );
        }
        // the whole row is the tap target; the pill is just its visual cue
        return (
          <Pressable
            key={lesson.id}
            onPress={() => router.push(`/lesson/${lesson.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${action} ${lesson.title}${isDone ? ", completed" : ""}`}
            style={({ pressed }) => [rowStyle, pressed && styles.pressed]}
          >
            {badge}
            {title}
            <View style={[styles.btnPrimary, { paddingVertical: 8, paddingHorizontal: 16 }]}>
              <Text style={styles.btnPrimaryText}>{action}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  const statText = { fontWeight: "700" as const };

  return (
    <View style={styles.screen}>
      {/* Two rows: brand + actions, then stats. One row overflowed on
          ~360pt-wide phones once XP reached four digits. */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs, flexDirection: "column", alignItems: "stretch" }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.primary }} accessibilityRole="header">
            Aral
          </Text>
          <View
            accessible
            accessibilityLabel={`Level ${level}`}
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
          <Pressable
            onPress={() => router.push("/words")}
            accessibilityRole="button"
            accessibilityLabel="Open phrasebook"
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <Text style={{ fontSize: 20 }}>📖</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/stats")}
            accessibilityRole="button"
            accessibilityLabel="View stats"
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <Text style={{ fontSize: 20 }}>📊</Text>
          </Pressable>
          <Pressable
            onPress={toggle}
            accessibilityRole="switch"
            accessibilityLabel="Dark mode"
            accessibilityState={{ checked: mode === "dark" }}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <Text style={{ fontSize: 20 }}>🌓</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Text
            style={[statText, { color: colors.text }]}
            accessibilityLabel={`${streak} day streak`}
          >
            🔥 {streak}
          </Text>
          <Text
            style={[statText, { color: colors.warningText }]}
            accessibilityLabel={`${progress.xpTotal} XP`}
          >
            ⚡ {progress.xpTotal} XP
          </Text>
          <Text
            style={[statText, { color: colors.heart }]}
            accessibilityLabel={`${hearts} of ${MAX_HEARTS} hearts`}
          >
            ❤️ {hearts}/{MAX_HEARTS}
          </Text>
        </View>
      </View>

      {/* virtualized: the course is 50+ units, far too many lesson rows to
          mount eagerly in a ScrollView on a mid-range phone */}
      <FlatList
        data={bundle.units}
        keyExtractor={(u) => u.id}
        renderItem={renderUnit}
        // bottom inset keeps the last card clear of the home indicator
        contentContainerStyle={[styles.container, { paddingBottom: spacing.md + insets.bottom }]}
        initialNumToRender={4}
        windowSize={5}
        removeClippedSubviews
        refreshControl={
          user ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primaryFill]}
              progressBackgroundColor={colors.bg}
            />
          ) : undefined
        }
        ListHeaderComponent={
          <View style={{ gap: spacing.md }}>
            {!user && (
              <Text style={styles.muted}>
                Playing as guest —{" "}
                <Link href="/register" style={{ color: colors.accent, fontWeight: "700" }}>
                  create an account
                </Link>{" "}
                to back up progress.
              </Text>
            )}
            {user && needsRelogin && (
              <Pressable
                onPress={() => router.push("/login")}
                accessibilityRole="button"
                style={({ pressed }) => [{ minHeight: 44, justifyContent: "center" }, pressed && styles.pressed]}
              >
                <Text style={[styles.muted, { color: colors.danger, fontWeight: "700" }]}>
                  Session expired — tap to log in again. Progress stays on this device until you do.
                </Text>
              </Pressable>
            )}
            {user && pendingCount > 0 && (
              <Text style={styles.muted}>{pendingCount} change(s) waiting to sync…</Text>
            )}

            {/* one obvious next action, so a learner 30 units deep doesn't
                have to scroll the whole map to find where they left off */}
            {next ? (
              <View style={[styles.card, { gap: spacing.xs }]}>
                <Text style={styles.muted}>
                  {progress.lessonsCompleted > 0 ? "Jump back in" : "Start here"}
                </Text>
                <Text style={[styles.subtitle, { marginBottom: 0 }]}>{next.lesson.title}</Text>
                <Text style={styles.muted}>
                  Unit {next.unitIndex + 1} · {next.unit.title}
                  {streak > 0 ? ` · 🔥 ${streak}-day streak` : ""}
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.btnPrimary, { marginTop: spacing.sm }, pressed && styles.pressed]}
                  onPress={() => router.push(`/lesson/${next.lesson.id}`)}
                  accessibilityRole="button"
                >
                  <Text style={styles.btnPrimaryText}>
                    {progress.lessonsCompleted > 0 ? "Continue" : "Start learning"} +{next.lesson.xp} XP
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={[styles.card, { gap: spacing.xs }]}>
                <Text style={styles.muted}>Course complete</Text>
                <Text style={[styles.subtitle, { marginBottom: 0 }]}>You finished every lesson! 🏆</Text>
                <Text style={styles.muted}>Replay any lesson below to practice and earn hearts back.</Text>
              </View>
            )}

            {reviewable > 0 && (
              <Pressable
                style={({ pressed }) => [
                  styles.card,
                  { flexDirection: "row", alignItems: "center", gap: spacing.sm },
                  pressed && styles.pressed,
                ]}
                onPress={() => router.push("/lesson/review")}
                accessibilityRole="button"
                accessibilityLabel={`Review your mistakes: ${reviewable} exercise${reviewable > 1 ? "s" : ""}, plus ${PRACTICE_XP} XP and 1 heart`}
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
          </View>
        }
        ListFooterComponent={
          user ? (
            <Pressable
              style={({ pressed }) => [styles.btnGhost, { paddingHorizontal: spacing.md }, pressed && styles.pressed]}
              onPress={confirmLogout}
              accessibilityRole="button"
              accessibilityLabel={`Log out of ${user.email}`}
            >
              <Text style={styles.btnGhostText} numberOfLines={1} ellipsizeMode="middle">
                Log out ({user.email})
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}
              onPress={() => router.push("/login")}
              accessibilityRole="button"
            >
              <Text style={styles.btnGhostText}>Log in</Text>
            </Pressable>
          )
        }
      />
    </View>
  );
}
