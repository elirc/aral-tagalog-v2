import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Alert,
  Animated,
  BackHandler,
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
  buildReviewLesson,
  currentExercise,
  dueReviewIds,
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
  REVIEW_LESSON_ID,
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
import { findNextLesson } from "@/lib/nextLesson";
import { deviceTz, newEventId, useProgress } from "@/lib/progress";
import { font, ICON_MAX_SCALE, radii, spacing, useTheme } from "@/theme";
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
  /** exercises a review session started now would hold (0 = nothing due) */
  reviewCount: number;
}

/** Continue is ignored for this long after feedback appears, so the second
 *  tap of a double-tap on Check can't dismiss the result before it is seen */
const CONTINUE_GUARD_MS = 350;

/** pressed: the 4pt bottom edge sinks to 2pt; margin + translate keep the
 *  layout box fixed so neighbours don't jump */
const pressDown = { borderBottomWidth: 2, marginBottom: 2, transform: [{ translateY: 2 }] } as const;

function PrimaryButton({
  label,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const { styles } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      // btnPrimary is ~54pt tall (14pt padding ×2 + label + 4pt edge)
      style={({ pressed }) => [styles.btnPrimary, disabled && styles.btnPrimaryDisabled, pressed && pressDown]}
    >
      <Text style={[styles.btnPrimaryText, disabled && styles.btnPrimaryTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

/** Outlined second-choice action; 48pt tall. */
function SecondaryButton({
  label,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const { colors, styles } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btnGhost,
        { minHeight: 48, borderColor: colors.borderStrong, backgroundColor: colors.bg },
        pressed && styles.pressed,
      ]}
    >
      <Text style={{ color: colors.text, fontWeight: "700", fontSize: font.sizeMd }}>{label}</Text>
    </Pressable>
  );
}

/** Borderless third-choice action; still a full-width 44pt target. */
function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, styles } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        { minHeight: 44, alignItems: "center", justifyContent: "center" },
        pressed && styles.pressed,
      ]}
    >
      <Text style={{ color: colors.textMuted, fontWeight: "700", fontSize: font.sizeMd }}>{label}</Text>
    </Pressable>
  );
}

/** Pinned footer: the primary action stays under the thumb, clear of the home
 *  indicator, while the content above it scrolls. */
function BottomBar({
  children,
  bottomInset,
  tone = "neutral",
  gap = spacing.md,
}: {
  children: ReactNode;
  bottomInset: number;
  tone?: "neutral" | "correct" | "wrong";
  /** tighter for a stack of several actions */
  gap?: number;
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
        gap,
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
        <Text maxFontSizeMultiplier={ICON_MAX_SCALE} style={{ color: "#fff", fontSize: 20, fontWeight: "900" }}>
          {correct ? "✓" : "✕"}
        </Text>
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

  // Leaving mid-lesson throws the session away, so ✕, Android back and the
  // iOS edge swipe all confirm first once there's something to lose. The
  // completion and out-of-hearts screens have nothing to lose and leave freely.
  const gated = !practice && hearts <= 0 && phase.kind === "answering";
  const inProgress =
    !session.done &&
    !gated &&
    (session.solved > 0 || session.mistakes > 0 || phase.kind === "feedback" || answer !== null);
  const inProgressRef = useRef(inProgress);
  inProgressRef.current = inProgress;

  const quit = useCallback(() => {
    if (!inProgressRef.current) {
      router.dismissTo("/");
      return;
    }
    Alert.alert("Quit this lesson?", "Your progress in this lesson won't be saved.", [
      { text: "Keep learning", style: "cancel" },
      { text: "Quit", style: "destructive", onPress: () => router.dismissTo("/") },
    ]);
  }, [router]);

  // Intentional exits from the completion / out-of-hearts screens. They never
  // pass through `quit`, so no confirmation fires; `replace` swaps this screen
  // out (back still lands on the course map) and the `run` nonce makes the
  // route mount a brand-new session even for review → review.
  const leftAt = useRef(0);
  const leaveOnce = useCallback((go: () => void) => {
    // one navigation per tap burst: a double-tap would otherwise replace twice
    const now = Date.now();
    if (now - leftAt.current < 1000) return;
    leftAt.current = now;
    go();
  }, []);
  const goToLesson = useCallback(
    (id: string) => leaveOnce(() => router.replace(`/lesson/${id}?run=${Date.now()}`)),
    [leaveOnce, router],
  );
  const goHome = useCallback(() => leaveOnce(() => router.dismissTo("/")), [leaveOnce, router]);

  useEffect(() => {
    // registered after the navigator's own handler, so it runs first
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!inProgressRef.current) return false; // plain pop
      quit();
      return true;
    });
    return () => sub.remove();
  }, [quit]);

  // native-stack can't intercept the iOS swipe-back gesture, only disable it.
  // Rendered in every branch below: options persist after this element unmounts.
  const screenOptions = <Stack.Screen options={{ gestureEnabled: !inProgress }} />;

  // one submission per exercise attempt: a fast double-tap (or the keyboard's
  // return key racing the Check button) can fire twice before the re-render
  // and would charge a second heart
  const answeredKey = useRef<string | null>(null);
  /** when the current feedback appeared (see CONTINUE_GUARD_MS) */
  const feedbackShownAt = useRef(0);

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
      reviewCount: buildReviewLesson(bundle.units, dueReviewIds(after, now))?.exercises.length ?? 0,
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

    // every exercise ends on one right answer, so right answers = exercise
    // count and each mistake (incl. wrong pairings) is one more attempt
    const answered = lesson.exercises.length + session.mistakes;
    const accuracy = answered > 0 ? Math.round((lesson.exercises.length / answered) * 100) : 100;
    const mistakeText =
      session.mistakes === 0 ? "no mistakes" : `${session.mistakes} mistake${session.mistakes > 1 ? "s" : ""}`;

    // where the course map's "Jump back in" will point once this completion
    // lands: this lesson counts as done whether or not the event has folded yet
    const upNext = findNextLesson(bundle.units, [...progress.completedLessonIds, lesson.id]);
    // offered only when this session had misses; N is what the review session
    // will actually hold (the due queue, capped), which includes them
    const reviewCount = session.missedExerciseIds.length > 0 ? (summary?.reviewCount ?? 0) : 0;

    // fragment: the screen's SafeAreaView is the flex column for scroll + footer
    return (
      <>
        {screenOptions}
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
            <Text
              style={[styles.body, { fontWeight: "700" }]}
              accessibilityLabel={`Accuracy ${accuracy} percent, ${mistakeText}`}
            >
              🎯 {accuracy}% accuracy · {mistakeText}
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
        <BottomBar bottomInset={insets.bottom} gap={spacing.sm}>
          {upNext ? (
            <>
              <Text style={[styles.muted, { textAlign: "center" }]} numberOfLines={1}>
                Up next: {upNext.lesson.title}
              </Text>
              <PrimaryButton
                label={practice ? "Continue course" : "Next lesson"}
                accessibilityLabel={`${practice ? "Continue course" : "Next lesson"}: ${upNext.lesson.title}`}
                onPress={() => goToLesson(upNext.lesson.id)}
              />
            </>
          ) : (
            <PrimaryButton label="Back to course" onPress={goHome} />
          )}
          {reviewCount > 0 && (
            <SecondaryButton
              label={`Review ${reviewCount} mistake${reviewCount > 1 ? "s" : ""}`}
              onPress={() => goToLesson(REVIEW_LESSON_ID)}
            />
          )}
          {upNext && <TextButton label="Back to course" onPress={goHome} />}
        </BottomBar>
      </>
    );
  }

  // gate only between exercises: when the last heart is lost, the user must
  // still see the feedback for the mistake that cost it before this screen
  if (gated) {
    const ms = msUntilNextHeart(progress.hearts, Date.now());
    // the misses that emptied the hearts are already scheduled (hearts_lost
    // carries the exercise id), so there is nearly always something to review
    const reviewCount =
      buildReviewLesson(bundle.units, dueReviewIds(progress, Date.now()))?.exercises.length ?? 0;
    const hasCompleted = progress.completedLessonIds.length > 0;
    return (
      <View style={{ flex: 1 }}>
        {screenOptions}
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
              {reviewCount > 0
                ? "Review your mistakes to earn a heart back — review never costs hearts — or wait for hearts to regenerate. This lesson starts over when you return to it."
                : hasCompleted
                  ? "Practice a completed lesson to earn one back, or wait for hearts to regenerate."
                  : "Hearts regenerate over time. Come back when the next one is ready."}
            </Text>
            {ms !== null && (
              <Text style={styles.muted}>Next heart in ~{Math.max(1, Math.ceil(ms / 60_000))} min</Text>
            )}
          </View>
        </ScrollView>
        <BottomBar bottomInset={insets.bottom} gap={spacing.sm}>
          {reviewCount > 0 ? (
            <>
              <PrimaryButton
                label="Review your mistakes"
                accessibilityLabel={`Review your mistakes: ${reviewCount} exercise${reviewCount > 1 ? "s" : ""}, plus ${PRACTICE_XP} XP and 1 heart`}
                onPress={() => goToLesson(REVIEW_LESSON_ID)}
              />
              <SecondaryButton label="Back to course" onPress={goHome} />
            </>
          ) : (
            <PrimaryButton label="Back to course" onPress={goHome} />
          )}
        </BottomBar>
      </View>
    );
  }

  if (!exercise) return screenOptions;

  const key = `${exercise.id}-${attempt}`;
  // layout seed: fixed for the whole attempt (session only advances on
  // Continue), different the next time this exercise comes round
  const salt = session.attempts ?? 0;

  const check = () => {
    if (answer === null || answeredKey.current === key) return;
    answeredKey.current = key;
    const outcome = submitAnswer(session, answer);
    if (!outcome.correct) {
      // practice / review runs cost no hearts (count 0), but the miss is still
      // reported so the exercise is scheduled for review right away — even if
      // this session never reaches lesson_completed
      addEvents([
        {
          id: newEventId(),
          type: "hearts_lost",
          occurredAt: Date.now(),
          count: practice ? 0 : 1,
          exerciseId: exercise.id,
        },
      ]);
    }
    feedbackShownAt.current = Date.now();
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
    if (answeredKey.current === key) return;
    answeredKey.current = key;
    const outcome = submitAnswer(session, "", mistakes);
    if (mistakes > 0) {
      addEvents([
        {
          id: newEventId(),
          type: "hearts_lost",
          occurredAt: Date.now(),
          // practice / review: no hearts at stake, the miss is still recorded
          count: practice ? 0 : Math.min(mistakes, hearts),
          exerciseId: exercise.id,
        },
      ]);
    }
    setSession(outcome.state);
    setAnswer(null);
    setAttempt((n) => n + 1);
  };

  const advance = () => {
    if (phase.kind !== "feedback") return;
    // the tail of a double-tap on Check lands on Continue (same spot): ignore it
    if (Date.now() - feedbackShownAt.current < CONTINUE_GUARD_MS) return;
    setSession(phase.next);
    setPhase({ kind: "answering" });
    setAnswer(null);
    setAttempt((n) => n + 1);
  };

  const disabled = phase.kind === "feedback";
  const pct = Math.round(sessionProgress(session) * 100);
  const hasFooter = exercise.type !== "match_pairs";

  return (
    // keep the Check/Continue footer reachable while the fill-blank TextInput
    // has the keyboard up. Android: none — the window itself resizes
    // (app.json softwareKeyboardLayoutMode "resize", edge-to-edge off), and
    // padding on top of that would double the gap.
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {screenOptions}
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
          onPress={quit}
          accessibilityRole="button"
          accessibilityLabel="Quit lesson"
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
          <Text maxFontSizeMultiplier={ICON_MAX_SCALE} style={{ fontSize: 22, color: colors.textMuted }}>
            ✕
          </Text>
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
            <ChoiceView key={key} exercise={exercise} salt={salt} onAnswerChange={setAnswer} disabled={disabled} />
          )}
          {(exercise.type === "translate_taps" || exercise.type === "listen") && (
            <TapsView key={key} exercise={exercise} salt={salt} onAnswerChange={setAnswer} disabled={disabled} />
          )}
          {exercise.type === "fill_blank" && (
            <FillBlankView
              key={key}
              exercise={exercise}
              salt={salt}
              onAnswerChange={setAnswer}
              disabled={disabled}
              onSubmit={check}
            />
          )}
          {exercise.type === "match_pairs" && (
            <MatchView key={key} exercise={exercise} salt={salt} onComplete={completeMatch} />
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
