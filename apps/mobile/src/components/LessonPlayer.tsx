import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  currentExercise,
  INTERSTITIAL_EVERY_N_LESSONS,
  isPerfect,
  lessonXp,
  MAX_HEARTS,
  regenerate,
  sessionProgress,
  startSession,
  submitAnswer,
  type Lesson,
  type SessionState,
  type UserAnswer,
} from "@aral/core";
import { ads } from "@/lib/ads";
import { playAudio } from "@/lib/audio";
import { newEventId, useProgress } from "@/lib/progress";
import { colors, spacing, styles } from "@/theme";
import { ChoiceView } from "./exercises/ChoiceView";
import { FillBlankView } from "./exercises/FillBlankView";
import { MatchView } from "./exercises/MatchView";
import { TapsView } from "./exercises/TapsView";

type Phase =
  | { kind: "answering" }
  | { kind: "feedback"; correct: boolean; correctAnswer: string; next: SessionState };

export function LessonPlayer({ lesson, practice }: { lesson: Lesson; practice: boolean }) {
  const router = useRouter();
  const { progress, addEvents } = useProgress();
  const [session, setSession] = useState<SessionState>(() => startSession(lesson));
  const [phase, setPhase] = useState<Phase>({ kind: "answering" });
  const [answer, setAnswer] = useState<UserAnswer | null>(null);
  const [attempt, setAttempt] = useState(0);
  const completionSent = useRef(false);

  const hearts = regenerate(progress.hearts, Date.now()).hearts;
  const exercise = currentExercise(session);

  useEffect(() => {
    if (!session.done || completionSent.current) return;
    completionSent.current = true;
    addEvents([
      {
        id: newEventId(),
        type: "lesson_completed",
        lessonId: lesson.id,
        occurredAt: Date.now(),
        perfect: isPerfect(session),
        xp: lessonXp(lesson, isPerfect(session)),
        practice: practice || undefined,
      },
    ]);
    // GAM-04: interstitial cadence — noop until the AdMob provider lands
    const completions = progress.completedLessonIds.length + 1;
    if (!practice && completions % INTERSTITIAL_EVERY_N_LESSONS === 0) void ads.showInterstitial();
  }, [session, lesson, practice, addEvents, progress.completedLessonIds.length]);

  if (session.done) {
    const perfect = isPerfect(session);
    return (
      <View style={[styles.card, { alignItems: "center", gap: spacing.sm, margin: spacing.md }]}>
        <Text style={{ fontSize: 56 }}>{perfect ? "🏆" : "🎉"}</Text>
        <Text style={styles.subtitle}>{perfect ? "Perfect lesson!" : "Lesson complete!"}</Text>
        <Text style={styles.body}>
          +{lessonXp(lesson, perfect)} XP{perfect ? " (includes perfect bonus)" : ""}
          {practice ? " · +1 ❤️ for practicing" : ""}
        </Text>
        <Pressable style={[styles.btnPrimary, { alignSelf: "stretch" }]} onPress={() => router.dismissTo("/")}>
          <Text style={styles.btnPrimaryText}>Continue</Text>
        </Pressable>
      </View>
    );
  }

  if (!practice && hearts <= 0) {
    return (
      <View style={[styles.card, { alignItems: "center", gap: spacing.sm, margin: spacing.md }]}>
        <Text style={{ fontSize: 56 }}>💔</Text>
        <Text style={styles.subtitle}>You're out of hearts</Text>
        <Text style={[styles.body, { textAlign: "center" }]}>
          Practice a completed lesson to earn one back, or wait for hearts to regenerate.
        </Text>
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
    <View style={{ flex: 1 }}>
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

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}>
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
                <Text style={{ fontWeight: "800", fontSize: 17 }}>
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
    </View>
  );
}
