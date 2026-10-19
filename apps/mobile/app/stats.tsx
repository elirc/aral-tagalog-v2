import type { ReactNode } from "react";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ACHIEVEMENTS,
  displayStreak,
  earnedAchievementIds,
  levelProgress,
  localDayKey,
} from "@aral/core";
import { getBundle } from "@/lib/content";
import { deviceTz, newEventId, useProgress } from "@/lib/progress";
import { font, radii, spacing, useTheme } from "@/theme";

const GOAL_PRESETS = [10, 20, 30, 50] as const;
const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"] as const;
const CHART_HEIGHT = 80;

/** Weekday initial for a "YYYY-MM-DD" key without relying on Intl. */
function weekdayInitial(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return WEEKDAY[new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()] ?? "";
}

/** The day key `n` calendar days before `todayKey` — pure key math, DST-safe. */
function dayKeyMinus(todayKey: string, n: number): string {
  const [y, m, d] = todayKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!) - n * 86_400_000);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

function Bar({ pct, color, height = 10 }: { pct: number; color?: string; height?: number }) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      style={{ height, backgroundColor: colors.border, borderRadius: radii.pill, overflow: "hidden" }}
    >
      <View
        style={{
          width: `${clamped}%`,
          height: "100%",
          backgroundColor: color ?? colors.primary,
          borderRadius: radii.pill,
        }}
      />
    </View>
  );
}

/** `label` is what a screen reader announces for the whole tile, instead of
 *  stepping through an emoji ("high voltage") and a bare number. */
function StatTile({ children, label }: { children: ReactNode; label: string }) {
  const { styles } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.card, { width: "48%", padding: spacing.sm, gap: spacing.xs }]}
    >
      {children}
    </View>
  );
}

function TileLabel({ children }: { children: ReactNode }) {
  const { styles } = useTheme();
  return (
    <Text style={styles.muted} numberOfLines={1}>
      {children}
    </Text>
  );
}

function TileValue({ children, color }: { children: ReactNode; color?: string }) {
  const { colors } = useTheme();
  return (
    // shrink rather than wrap/clip when a big XP total meets a narrow phone
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.6}
      style={{ fontSize: font.sizeLg, fontWeight: "800", color: color ?? colors.text }}
    >
      {children}
    </Text>
  );
}

export default function StatsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, styles } = useTheme();
  const { progress, addEvents } = useProgress();
  // deep link / cold start lands here with nothing to pop back to
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const bundle = getBundle();

  const now = Date.now();
  const tz = deviceTz();
  const todayKey = localDayKey(now, tz);

  const { level, xpIntoLevel, xpForNextLevel } = levelProgress(progress.xpTotal);
  const levelPct = xpForNextLevel > 0 ? (xpIntoLevel / xpForNextLevel) * 100 : 100;
  const streak = displayStreak(progress.streak, todayKey);

  const goal = progress.dailyGoalXp;
  const todayXp = progress.xpByDay[todayKey] ?? 0;
  const goalPct = goal > 0 ? (todayXp / goal) * 100 : 0;
  const goalReached = todayXp >= goal && todayXp > 0;

  // derive prior days from todayKey, not `now − 24h·n`: a 23/25-hour DST day
  // would duplicate one key and drop another
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const key = dayKeyMinus(todayKey, 6 - i);
    return { key, xp: progress.xpByDay[key] ?? 0 };
  });
  const maxDayXp = Math.max(1, ...last7.map((d) => d.xp));
  const weekTotal = last7.reduce((sum, d) => sum + d.xp, 0);

  const earned = new Set(earnedAchievementIds(progress, bundle.units));

  const setGoal = (goalXp: number) => {
    if (goalXp === goal) return;
    addEvents([{ id: newEventId(), type: "goal_set", occurredAt: Date.now(), goalXp }]);
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          style={({ pressed }) => [styles.iconBtn, { marginLeft: -spacing.sm }, pressed && styles.pressed]}
        >
          <Text style={{ fontSize: 22, color: colors.textMuted, paddingHorizontal: spacing.sm }}>‹ Back</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }} accessibilityRole="header">
          📊 Stats
        </Text>
      </View>

      <ScrollView
        // bottom inset keeps the last achievement clear of the home indicator
        contentContainerStyle={[styles.container, { paddingBottom: spacing.md + insets.bottom }]}
      >
        {/* Stat tiles */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: spacing.md }}>
          <StatTile label={`Total XP: ${progress.xpTotal}`}>
            <TileLabel>Total XP</TileLabel>
            <TileValue color={colors.warningText}>⚡ {progress.xpTotal}</TileValue>
          </StatTile>

          <StatTile label={`Level ${level}: ${xpIntoLevel} of ${xpForNextLevel} XP to level ${level + 1}`}>
            <TileLabel>Level</TileLabel>
            <TileValue color={colors.primary}>Lv {level}</TileValue>
            <Bar pct={levelPct} />
            <Text style={styles.muted}>
              {xpIntoLevel}/{xpForNextLevel} to Lv {level + 1}
            </Text>
          </StatTile>

          <StatTile label={`Streak: ${streak} days. Longest ${progress.longestStreak}`}>
            <TileLabel>Streak</TileLabel>
            <TileValue color={colors.heart}>🔥 {streak}</TileValue>
            <Text style={styles.muted}>Longest {progress.longestStreak}</Text>
          </StatTile>

          <StatTile label={`Lessons done: ${progress.lessonsCompleted}`}>
            <TileLabel>Lessons done</TileLabel>
            <TileValue>📚 {progress.lessonsCompleted}</TileValue>
          </StatTile>

          <StatTile label={`Perfect lessons: ${progress.perfectLessons}`}>
            <TileLabel>Perfect lessons</TileLabel>
            <TileValue>✨ {progress.perfectLessons}</TileValue>
          </StatTile>

          <StatTile label={`Practice runs: ${progress.practiceCount}`}>
            <TileLabel>Practice runs</TileLabel>
            <TileValue>🔁 {progress.practiceCount}</TileValue>
          </StatTile>
        </View>

        {/* Daily goal */}
        <View style={[styles.card, { gap: spacing.sm }]}>
          <Text style={styles.subtitle}>Daily goal</Text>
          <Text style={styles.body}>
            {todayXp} / {goal} XP today
            {goalReached ? "  🎯" : ""}
          </Text>
          <Bar pct={goalPct} color={goalReached ? colors.primary : colors.warning} height={14} />
          <Text style={styles.muted}>Set your daily goal</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }} accessibilityRole="radiogroup">
            {GOAL_PRESETS.map((g) => {
              const selected = g === goal;
              return (
                <Pressable
                  key={g}
                  onPress={() => setGoal(g)}
                  accessibilityRole="radio"
                  accessibilityLabel={`Daily goal ${g} XP`}
                  accessibilityState={{ selected, checked: selected }}
                  style={({ pressed }) => [
                    {
                      flex: 1,
                      minHeight: 44,
                      paddingVertical: 10,
                      borderRadius: radii.md,
                      borderWidth: 2,
                      alignItems: "center",
                      justifyContent: "center",
                      // primaryFill, not primary: white on #58a700 is only 3:1
                      borderColor: selected ? colors.primaryFill : colors.border,
                      backgroundColor: selected ? colors.primaryFill : colors.bg,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={{ fontWeight: "800", color: selected ? "#fff" : colors.text }}>{g}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Last 7 days */}
        <View style={[styles.card, { gap: spacing.sm }]}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
            <Text style={styles.subtitle}>Last 7 days</Text>
            <Text style={styles.muted}>{weekTotal} XP</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "flex-end", height: CHART_HEIGHT + 24, gap: spacing.xs }}>
            {last7.map((d) => {
              const isToday = d.key === todayKey;
              const barH = d.xp === 0 ? 4 : Math.max(6, Math.round((d.xp / maxDayXp) * CHART_HEIGHT));
              return (
                <View
                  key={d.key}
                  accessible
                  accessibilityLabel={`${isToday ? "Today" : d.key}: ${d.xp} XP`}
                  style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}
                >
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 2 }}>
                    {d.xp > 0 ? d.xp : ""}
                  </Text>
                  <View
                    style={{
                      width: 18,
                      height: barH,
                      borderRadius: radii.sm,
                      backgroundColor: isToday ? colors.primary : d.xp > 0 ? colors.warning : colors.border,
                    }}
                  />
                  <Text
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      fontWeight: isToday ? "800" : "600",
                      color: isToday ? colors.primary : colors.textMuted,
                    }}
                  >
                    {weekdayInitial(d.key)}
                  </Text>
                </View>
              );
            })}
          </View>
          {weekTotal === 0 && (
            <Text style={styles.muted}>Complete a lesson to start earning XP.</Text>
          )}
        </View>

        {/* Achievements */}
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: spacing.xs }}>
            <Text style={styles.subtitle}>Achievements</Text>
            <Text style={styles.muted}>
              {earned.size}/{ACHIEVEMENTS.length}
            </Text>
          </View>
          {ACHIEVEMENTS.map((a, i) => {
            const isEarned = earned.has(a.id);
            return (
              <View
                key={a.id}
                accessible
                accessibilityLabel={`${a.title}, ${isEarned ? "earned" : "locked"}. ${a.description}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  paddingVertical: spacing.sm,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                  opacity: isEarned ? 1 : 0.4,
                }}
              >
                <Text style={{ fontSize: 28 }}>{a.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "800", color: colors.text }}>{a.title}</Text>
                  <Text style={styles.muted}>{a.description}</Text>
                </View>
                <Text style={{ fontSize: 18, fontWeight: "800", color: isEarned ? colors.primary : colors.textMuted }}>
                  {isEarned ? "✓" : "🔒"}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
