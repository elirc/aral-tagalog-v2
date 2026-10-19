import { useRef } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { buildReviewLesson, REVIEW_LESSON_ID, type Lesson } from "@aral/core";
import { LessonPlayer } from "@/components/LessonPlayer";
import { findLesson, getBundle, isLessonUnlocked } from "@/lib/content";
import { useProgress } from "@/lib/progress";
import { spacing, useTheme } from "@/theme";

export default function LessonScreen() {
  const router = useRouter();
  const { styles } = useTheme();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const { progress } = useProgress();

  const isReview = lessonId === REVIEW_LESSON_ID;
  const found = !isReview && lessonId ? findLesson(lessonId) : null;
  // Capture the review lesson once: completing it clears ids from
  // weakExerciseIds, and a live recompute would yank the completion screen
  // away (or reshuffle exercises) mid-session.
  const reviewRef = useRef<Lesson | null | undefined>(undefined);
  const practiceRef = useRef<boolean | null>(null);
  if (isReview && reviewRef.current === undefined) {
    reviewRef.current = buildReviewLesson(getBundle().units, progress.weakExerciseIds);
  }
  const reviewLesson = isReview ? (reviewRef.current ?? null) : null;
  const lesson = isReview ? reviewLesson : (found?.lesson ?? null);

  if (isReview && !reviewLesson) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={[styles.card, { alignItems: "center", gap: spacing.sm, margin: spacing.md }]}>
          <Text style={{ fontSize: 56 }}>🧹</Text>
          <Text style={styles.subtitle}>Nothing to review</Text>
          <Text style={[styles.body, { textAlign: "center" }]}>
            Mistakes you make in lessons collect here so you can practice them again.
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
          <Text style={styles.subtitle}>{lesson ? "Finish earlier lessons first" : "Lesson not found"}</Text>
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
