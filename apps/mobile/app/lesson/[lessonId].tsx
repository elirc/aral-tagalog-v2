import { useRef } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { buildReviewLesson, dueReviewIds, REVIEW_LESSON_ID, type Lesson } from "@aral/core";
import { LessonPlayer } from "@/components/LessonPlayer";
import { findLesson, getBundle, isLessonUnlocked } from "@/lib/content";
import { useProgress } from "@/lib/progress";
import { spacing, useTheme } from "@/theme";

/**
 * Everything below freezes per-session state in refs (the review set, the
 * practice flag), so the session screen is keyed by the route's lesson id and
 * `run` nonce: going lesson → lesson, or review → review, from the completion
 * screen always mounts a fresh session even if the navigator reuses this
 * route component.
 */
export default function LessonScreen() {
  const { lessonId, run } = useLocalSearchParams<{ lessonId: string; run?: string }>();
  return <LessonSession key={`${lessonId ?? ""}:${run ?? ""}`} lessonId={lessonId} />;
}

function LessonSession({ lessonId }: { lessonId: string | undefined }) {
  const router = useRouter();
  const { styles } = useTheme();
  const { progress } = useProgress();

  const isReview = lessonId === REVIEW_LESSON_ID;
  const found = !isReview && lessonId ? findLesson(lessonId) : null;
  // Capture the review lesson once: completing it clears ids from
  // weakExerciseIds, and a live recompute would yank the completion screen
  // away (or reshuffle exercises) mid-session.
  const reviewRef = useRef<Lesson | null | undefined>(undefined);
  const practiceRef = useRef<boolean | null>(null);
  if (isReview && reviewRef.current === undefined) {
    // due as of this moment, not as of the provider's last fold
    reviewRef.current = buildReviewLesson(getBundle().units, dueReviewIds(progress, Date.now()));
  }
  const reviewLesson = isReview ? (reviewRef.current ?? null) : null;
  const lesson = isReview ? reviewLesson : (found?.lesson ?? null);

  if (isReview && !reviewLesson) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={[styles.card, { alignItems: "center", gap: spacing.sm, margin: spacing.md }]}>
          <Text style={{ fontSize: 56 }} accessibilityElementsHidden importantForAccessibility="no">
            🧹
          </Text>
          <Text style={styles.subtitle} accessibilityRole="header">
            Nothing to review
          </Text>
          <Text style={[styles.body, { textAlign: "center" }]}>
            Mistakes you make in lessons collect here so you can practice them again. Ones you've cleared come back
            for another look after a few days.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.btnPrimary, { alignSelf: "stretch" }, pressed && { opacity: 0.85 }]}
            onPress={() => router.dismissTo("/")}
          >
            <Text style={styles.btnPrimaryText}>Back to course</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // review skips the unlock check: it's a pseudo-lesson outside the course path
  if (!lesson || (!isReview && !isLessonUnlocked(lessonId!, progress.completedLessonIds))) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={[styles.card, { alignItems: "center", gap: spacing.sm, margin: spacing.md }]}>
          <Text style={styles.subtitle} accessibilityRole="header">
            {lesson ? "Finish earlier lessons first" : "Lesson not found"}
          </Text>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.btnPrimary, { alignSelf: "stretch" }, pressed && { opacity: 0.85 }]}
            onPress={() => router.dismissTo("/")}
          >
            <Text style={styles.btnPrimaryText}>Back to course</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Review sessions are always practice: no hearts lost, one refilled at the
  // end. Frozen at entry — finishing the lesson adds it to completedLessonIds,
  // which would otherwise flip this mid-session and rewrite the summary that
  // is already on screen ("+5 XP for practicing" over a first-time completion).
  if (practiceRef.current === null) {
    practiceRef.current = isReview || progress.completedLessonIds.includes(lesson.id);
  }
  const practice = practiceRef.current;
  // bottom edge deliberately excluded: LessonPlayer pins its action footer to
  // the screen edge and pads it by the inset itself, so the footer's tint runs
  // under the home indicator and the pad can drop while the keyboard is up
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <LessonPlayer key={lesson.id} lesson={lesson} practice={practice} />
    </SafeAreaView>
  );
}
