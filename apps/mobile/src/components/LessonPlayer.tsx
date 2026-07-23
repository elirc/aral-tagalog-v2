import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
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
import { radii, spacing, useTheme } from "@/theme";
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

    return (
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}>
        <View style={[styles.card, { alignItems: "center", gap: spacing.sm }]}>
          <Text style={{ fontSize: 56 }}>{perfect ? "🏆" : "🎉"}</Text>
          <Text style={styles.subtitle}>{perfect ? "Perfect lesson!" : "Lesson complete!"}</Text>
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

          <Pressable style={[styles.btnPrimary, { alignSelf: "stretch" }]} onPress={() => router.dismissTo("/")}>
            <Text style={styles.btnPrimaryText}>Continue</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  // gate only between exercises: when the last heart is lost, the user must
  // still see the feedback for the mistake that cost it before this screen
  if (!practice && hearts <= 0 && phase.kind === "answering") {
    const ms = msUntilNextHeart(progress.hearts, Date.now());
    return (
      <View style={[styles.card, { alignItems: "center", gap: spacing.sm, margin: spacing.md }]}>
        <Text style={{ fontSize: 56 }}>💔</Text>
        <Text style={styles.subtitle}>You're out of hearts</Text>
        <Text style={[styles.body, { textAlign: "center" }]}>
          Practice a completed lesson to earn one back, or wait for hearts to regenerate.
        </Text>
        {ms !== null && (
          <Text style={styles.muted}>Next heart in ~{Math.max(1, Math.ceil(ms / 60_000))} min</Text>
        )}
        <Pressable style={[styles.btnPrimary, { alignSelf: "stretch" }]} onPress={() => router.dismissTo("/")}>
          <Text style={styles.btnPrimaryText}>Back to course</Text>
        </Pressable>
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

  return (
    // keep the Check/Continue footer reachable while the fill-blank TextInput
    // has the keyboard up
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md }}>
        <Pressable onPress={() => router.dismissTo("/")} accessibilityLabel="quit lesson">
          <Text style={{ fontSize: 22, color: colors.textMuted }}>✕</Text>
        </Pressable>
        <View style={{ flex: 1, height: 14, backgroundColor: colors.border, borderRadius: 999, overflow: "hidden" }}>
          <View
            style={{
              width: `${sessionProgress(session) * 100}%`,
              height: "100%",
              backgroundColor: colors.primary,
              borderRadius: 999,
            }}
          />
        </View>
        <Text style={{ color: colors.heart, fontWeight: "800" }}>
          {practice ? "practice" : `❤️ ${hearts}/${MAX_HEARTS}`}
        </Text>
      </View>

      {/* persistTaps: without it the first tap on Check only dismisses the keyboard */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
      >
        <View style={styles.card}>
          {exercise.type === "choice" && (
            <ChoiceView key={key} exercise={exercise} onAnswerChange={setAnswer} disabled={disabled} />
          )}
          {(exercise.type === "translate_taps" || exercise.type === "listen") && (
            <TapsView key={key} exercise={exercise} onAnswerChange={setAnswer} disabled={disabled} />
          )}
          {exercise.type === "fill_blank" && (
            <FillBlankView key={key} exercise={exercise} onAnswerChange={setAnswer} disabled={disabled} />
          )}
          {exercise.type === "match_pairs" && (
            <MatchView key={key} exercise={exercise} onComplete={completeMatch} />
          )}
        </View>

        {exercise.type !== "match_pairs" && (
          <View
            style={{
              marginTop: spacing.md,
              padding: phase.kind === "feedback" ? spacing.md : 0,
              borderRadius: 16,
              backgroundColor:
                phase.kind === "feedback" ? (phase.correct ? colors.correctBg : colors.wrongBg) : "transparent",
            }}
          >
            {phase.kind === "feedback" ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={{ fontWeight: "800", fontSize: 17, color: colors.text }}>
                  {phase.correct ? "Nice!" : "Not quite."}
                </Text>
                {!phase.correct && phase.correctAnswer ? (
                  <Text style={styles.body}>Correct answer: {phase.correctAnswer}</Text>
                ) : null}
                <Pressable style={styles.btnPrimary} onPress={advance}>
                  <Text style={styles.btnPrimaryText}>Continue</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[styles.btnPrimary, answer === null && styles.btnPrimaryDisabled]}
                disabled={answer === null}
                onPress={check}
              >
                <Text style={styles.btnPrimaryText}>Check</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
