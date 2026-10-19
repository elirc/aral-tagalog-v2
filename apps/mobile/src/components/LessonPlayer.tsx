import { useRouter } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ACHIEVEMENTS,
  currentExercise,
  earnedAchievementIds,
  INTERSTITIAL_EVERY_N_LESSONS,
  isPerfect,
  lessonXp,
  levelForXp,
  localDayKey,
  MAX_HEARTS,
  msUntilNextHeart,
  PRACTICE_XP,
  reduceEvents,
  regenerate,
  sessionProgress,
  sessionReviewOutcome,
  startSession,
  submitAnswer,
  type Lesson,
  type ProgressEvent,
  type SessionState,
  type UserAnswer,
} from "@aral/core";
import { ads } from "@/lib/ads";
import { playAudio } from "@/lib/audio";
import { getBundle } from "@/lib/content";
import { deviceTz, newEventId, useProgress } from "@/lib/progress";
import { font, radii, spacing, useTheme } from "@/theme";
import { ChoiceView } from "./exercises/ChoiceView";
import { FillBlankView } from "./exercises/FillBlankView";
import { MatchView } from "./exercises/MatchView";
import { TapsView } from "./exercises/TapsView";

type Phase =
  | { kind: "answering" }
  | { kind: "feedback"; correct: boolean; correctAnswer: string; next: SessionState };

interface CompletionSummary {
  todayXp: number;
  goal: number;
  goalReached: boolean;
  /** achievement ids newly unlocked by this completion */
  newlyUnlocked: string[];
  /** the level just reached, when this completion crossed a threshold */
  leveledUpTo: number | null;
}

/** pressed: the 4pt bottom edge sinks to 2pt; margin + translate keep the
 *  layout box fixed so neighbours don't jump */
const pressDown = { borderBottomWidth: 2, marginBottom: 2, transform: [{ translateY: 2 }] } as const;

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { styles } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      // btnPrimary is ~54pt tall (14pt padding ×2 + label + 4pt edge)
      style={({ pressed }) => [styles.btnPrimary, disabled && styles.btnPrimaryDisabled, pressed && pressDown]}
    >
      <Text style={styles.btnPrimaryText}>{label}</Text>
    </Pressable>
  );
}

/** Pinned footer: the primary action stays under the thumb, clear of the home
 *  indicator, while the content above it scrolls. */
function BottomBar({
  children,
  bottomInset,
  tone = "neutral",
}: {
  children: ReactNode;
  bottomInset: number;
  tone?: "neutral" | "correct" | "wrong";
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: bottomInset + spacing.md,
        borderTopWidth: 2,
        borderTopColor: tone === "correct" ? colors.primary : tone === "wrong" ? colors.danger : colors.border,
        backgroundColor: tone === "correct" ? colors.correctBg : tone === "wrong" ? colors.wrongBg : colors.bg,
        gap: spacing.md,
      }}
    >
      {children}
    </View>
  );
}

/** Result line: icon + colored heading + text, so the verdict never rests on
 *  color alone. Slides in briefly on mount. */
function FeedbackResult({ correct, correctAnswer }: { correct: boolean; correctAnswer: string }) {
  const { colors, styles } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [anim]);
  const tint = correct ? colors.primaryDark : colors.danger;
  return (
    <Animated.View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm + 4,
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: correct ? colors.primaryFill : colors.danger,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900" }}>{correct ? "✓" : "✕"}</Text>
      </View>
      {/* flex: 1 lets a long correct answer wrap instead of running off-screen */}
      <View style={{ flex: 1, gap: spacing.xs }} accessible>
        <Text style={{ fontWeight: "800", fontSize: 20, color: tint }}>{correct ? "Nice!" : "Not quite."}</Text>
        {!correct && correctAnswer ? (
          <Text style={styles.body}>
            <Text style={{ fontWeight: "700" }}>Correct answer: </Text>
            {correctAnswer}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

export function LessonPlayer({ lesson, practice }: { lesson: Lesson; practice: boolean }) {
  const router = useRouter();
  const { colors, styles } = useTheme();
  const { progress, addEvents } = useProgress();
  const [session, setSession] = useState<SessionState>(() => startSession(lesson));
  const [phase, setPhase] = useState<Phase>({ kind: "answering" });
  const [answer, setAnswer] = useState<UserAnswer | null>(null);
  const [attempt, setAttempt] = useState(0);
  const completionSent = useRef(false);

  const bundle = getBundle();
  const [summary, setSummary] = useState<CompletionSummary | null>(null);

  const hearts = regenerate(progress.hearts, Date.now()).hearts;
  const exercise = currentExercise(session);

  // The screen's SafeAreaView covers only the top edge so the footer's tint can
  // run under the home indicator; the footer pads itself by the bottom inset —
  // except while the keyboard is up, which already covers that area.
  const insets = useSafeAreaInsets();
  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboardUp(true));
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const bottomInset = keyboardUp ? 0 : insets.bottom;

  useEffect(() => {
    if (session.done) AccessibilityInfo.announceForAccessibility("Lesson complete");
  }, [session.done]);

  // record the completion event exactly once, and compute the completion
  // summary from the *projected* progress (reduceEvents over the event before
  // appending) — reading live provider state instead renders one stale frame
  // and can shift again when the server baseline lands (same as web).
  useEffect(() => {
    if (!session.done || completionSent.current) return;
    completionSent.current = true;
    const perfect = isPerfect(session);
    // practice replays earn a flat, smaller award (server clamps to match)
    const xp = practice ? PRACTICE_XP : lessonXp(lesson, perfect);
    const now = Date.now();
    const tz = deviceTz();
    const { missedExerciseIds, masteredExerciseIds } = sessionReviewOutcome(session);
    const event: ProgressEvent = {
      id: newEventId(),
      type: "lesson_completed",
      lessonId: lesson.id,
      occurredAt: now,
      perfect,
      xp,
      practice: practice || undefined,
      missedExerciseIds: missedExerciseIds.length > 0 ? missedExerciseIds : undefined,
      masteredExerciseIds: masteredExerciseIds.length > 0 ? masteredExerciseIds : undefined,
    };
    const before = new Set(earnedAchievementIds(progress, bundle.units));
    const after = reduceEvents([event], tz, now, progress);
    const newlyUnlocked = earnedAchievementIds(after, bundle.units).filter((id) => !before.has(id));
    const todayXp = after.xpByDay[localDayKey(now, tz)] ?? 0;
    const levelAfter = levelForXp(after.xpTotal);
    setSummary({
      todayXp,
      goal: after.dailyGoalXp,
      goalReached: todayXp >= after.dailyGoalXp && todayXp > 0,
      newlyUnlocked,
      leveledUpTo: levelAfter > levelForXp(progress.xpTotal) ? levelAfter : null,
    });
    addEvents([event]);
    // GAM-04: interstitial cadence — noop until the AdMob provider lands
    const completions = progress.completedLessonIds.length + 1;
    if (!practice && completions % INTERSTITIAL_EVERY_N_LESSONS === 0) void ads.showInterstitial();
  }, [session, lesson, practice, addEvents, progress, bundle.units]);

  if (session.done) {
    const perfect = isPerfect(session);
    const goal = summary?.goal ?? progress.dailyGoalXp;
    const todayXp = summary?.todayXp ?? 0;
    const goalPct = goal > 0 ? Math.min(100, (todayXp / goal) * 100) : 100;
    const goalReached = summary?.goalReached ?? false;
    const newlyUnlocked = (summary?.newlyUnlocked ?? [])
      .map((id) => ACHIEVEMENTS.find((a) => a.id === id))
      .filter((a): a is (typeof ACHIEVEMENTS)[number] => Boolean(a));

    // fragment: the screen's SafeAreaView is the flex column for scroll + footer
    return (
      <>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.md, paddingTop: spacing.lg }}
        >
          <View style={[styles.card, { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg }]}>
            <Text style={{ fontSize: 56 }} accessibilityElementsHidden importantForAccessibility="no">
              {perfect ? "🏆" : "🎉"}
            </Text>
            <Text accessibilityRole="header" style={styles.subtitle}>
              {perfect ? "Perfect lesson!" : "Lesson complete!"}
            </Text>
            <Text style={styles.body}>
              +{practice ? PRACTICE_XP : lessonXp(lesson, perfect)} XP
              {perfect && !practice ? " (includes perfect bonus)" : ""}
              {practice ? " · +1 ❤️ for practicing" : ""}
            </Text>

            {summary?.leveledUpTo != null && (
              <View
                style={{
                  alignSelf: "stretch",
                  padding: spacing.sm,
                  borderRadius: radii.md,
                  backgroundColor: colors.correctBg,
                }}
              >
                <Text style={{ fontWeight: "800", color: colors.text, textAlign: "center" }}>
                  ⬆️ Level up! You reached Lv {summary.leveledUpTo}
                </Text>
              </View>
            )}

            <View style={{ alignSelf: "stretch", gap: spacing.xs, marginTop: spacing.xs }}>
              <Text style={styles.muted}>
                Daily goal · {todayXp}/{goal} XP{goalReached ? "  🎯 reached!" : ""}
              </Text>
              <View
                style={{
                  height: 14,
                  backgroundColor: colors.border,
                  borderRadius: radii.pill,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: `${goalPct}%`,
                    height: "100%",
                    backgroundColor: goalReached ? colors.primary : colors.warning,
                    borderRadius: radii.pill,
                  }}
                />
              </View>
            </View>

            {summary && newlyUnlocked.length > 0 && (
              <View style={{ alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.sm }}>
                <Text style={{ fontWeight: "800", color: colors.text, textAlign: "center" }}>
                  Achievement{newlyUnlocked.length > 1 ? "s" : ""} unlocked!
                </Text>
                {newlyUnlocked.map((a) => (
                  <View
                    key={a.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      padding: spacing.sm,
                      borderRadius: radii.md,
                      backgroundColor: colors.correctBg,
                    }}
                  >
                    <Text style={{ fontSize: 28 }}>{a.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "800", color: colors.text }}>{a.title}</Text>
                      <Text style={styles.muted}>{a.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
        <BottomBar bottomInset={insets.bottom}>
          <PrimaryButton label="Continue" onPress={() => router.dismissTo("/")} />
        </BottomBar>
      </>
    );
  }

  // gate only between exercises: when the last heart is lost, the user must
  // still see the feedback for the mistake that cost it before this screen
  if (!practice && hearts <= 0 && phase.kind === "answering") {
    const ms = msUntilNextHeart(progress.hearts, Date.now());
    return (
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.md }}
        >
          <View style={[styles.card, { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg }]}>
            <Text style={{ fontSize: 56 }} accessibilityElementsHidden importantForAccessibility="no">
              💔
            </Text>
            <Text accessibilityRole="header" style={styles.subtitle}>
              You're out of hearts
            </Text>
            <Text style={[styles.body, { textAlign: "center" }]}>
              Practice a completed lesson to earn one back, or wait for hearts to regenerate.
            </Text>
            {ms !== null && (
              <Text style={styles.muted}>Next heart in ~{Math.max(1, Math.ceil(ms / 60_000))} min</Text>
            )}
          </View>
        </ScrollView>
        <BottomBar bottomInset={insets.bottom}>
          <PrimaryButton label="Back to course" onPress={() => router.dismissTo("/")} />
        </BottomBar>
      </View>
    );
  }

  if (!exercise) return null;

  const check = () => {
    if (answer === null) return;
    const outcome = submitAnswer(session, answer);
    if (!outcome.correct && !practice) {
      addEvents([{ id: newEventId(), type: "hearts_lost", occurredAt: Date.now(), count: 1 }]);
    }
    if (exercise.audio && outcome.correct) void playAudio(exercise.audio);
    setPhase({ kind: "feedback", correct: outcome.correct, correctAnswer: outcome.correctAnswer, next: outcome.state });
    // the input is read-only from here on; drop the keyboard so the result shows
    Keyboard.dismiss();
    AccessibilityInfo.announceForAccessibility(
      outcome.correct
        ? "Correct!"
        : outcome.correctAnswer
          ? `Not quite. Correct answer: ${outcome.correctAnswer}`
          : "Not quite.",
    );
  };

  const completeMatch = (mistakes: number) => {
    const outcome = submitAnswer(session, "", mistakes);
    if (mistakes > 0 && !practice) {
      addEvents([
        { id: newEventId(), type: "hearts_lost", occurredAt: Date.now(), count: Math.min(mistakes, hearts) },
      ]);
    }
    setSession(outcome.state);
    setAnswer(null);
    setAttempt((n) => n + 1);
  };

  const advance = () => {
    if (phase.kind !== "feedback") return;
    setSession(phase.next);
    setPhase({ kind: "answering" });
    setAnswer(null);
    setAttempt((n) => n + 1);
  };

  const disabled = phase.kind === "feedback";
  const key = `${exercise.id}-${attempt}`;
  const pct = Math.round(sessionProgress(session) * 100);
  const hasFooter = exercise.type !== "match_pairs";

  return (
    // keep the Check/Continue footer reachable while the fill-blank TextInput
    // has the keyboard up
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
        }}
      >
        <Pressable
          onPress={() => router.dismissTo("/")}
          accessibilityRole="button"
          accessibilityLabel="quit lesson"
          hitSlop={12}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radii.pill,
            backgroundColor: pressed ? colors.border : "transparent",
          })}
        >
          <Text style={{ fontSize: 22, color: colors.textMuted }}>✕</Text>
        </Pressable>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="lesson progress"
          accessibilityValue={{ min: 0, max: 100, now: pct }}
          style={{ flex: 1, height: 14, backgroundColor: colors.border, borderRadius: 999, overflow: "hidden" }}
        >
          <View
            style={{
              width: `${pct}%`,
              height: "100%",
              backgroundColor: colors.primary,
              borderRadius: 999,
            }}
          />
        </View>
        <Text
          style={{ color: colors.heart, fontWeight: "800", fontSize: font.sizeMd, paddingRight: spacing.sm }}
          accessibilityLabel={practice ? "practice mode, no hearts at stake" : `${hearts} of ${MAX_HEARTS} hearts`}
        >
          {practice ? "practice" : `❤️ ${hearts}/${MAX_HEARTS}`}
        </Text>
      </View>

      {/* persistTaps: a tap on a word chip while the keyboard is up should land */}
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        contentContainerStyle={{
          padding: spacing.md,
          // match_pairs has no footer, so its content clears the home indicator itself
          paddingBottom: spacing.xl + (hasFooter ? 0 : bottomInset),
        }}
      >
        <View style={styles.card}>
          {exercise.type === "choice" && (
            <ChoiceView key={key} exercise={exercise} onAnswerChange={setAnswer} disabled={disabled} />
          )}
          {(exercise.type === "translate_taps" || exercise.type === "listen") && (
            <TapsView key={key} exercise={exercise} onAnswerChange={setAnswer} disabled={disabled} />
          )}
          {exercise.type === "fill_blank" && (
            <FillBlankView
              key={key}
              exercise={exercise}
              onAnswerChange={setAnswer}
              disabled={disabled}
              onSubmit={check}
            />
          )}
          {exercise.type === "match_pairs" && (
            <MatchView key={key} exercise={exercise} onComplete={completeMatch} />
          )}
        </View>
      </ScrollView>

      {/* outside the ScrollView: always visible, sits right on top of the keyboard */}
      {hasFooter && (
        <BottomBar
          bottomInset={bottomInset}
          tone={phase.kind === "feedback" ? (phase.correct ? "correct" : "wrong") : "neutral"}
        >
          {phase.kind === "feedback" ? (
            <>
              <FeedbackResult correct={phase.correct} correctAnswer={phase.correctAnswer} />
              <PrimaryButton label="Continue" onPress={advance} />
            </>
          ) : (
            <PrimaryButton label="Check" disabled={answer === null} onPress={check} />
          )}
        </BottomBar>
      )}
    </KeyboardAvoidingView>
  );
}
