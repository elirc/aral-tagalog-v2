import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LessonPlayer } from "@/components/LessonPlayer";
import { findLesson, isLessonUnlocked } from "@/lib/content";
import { useProgress } from "@/lib/progress";
import { spacing, styles } from "@/theme";

export default function LessonScreen() {
  const router = useRouter();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const { progress } = useProgress();

  const found = lessonId ? findLesson(lessonId) : null;
  if (!found || !isLessonUnlocked(lessonId!, progress.completedLessonIds)) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={[styles.card, { alignItems: "center", gap: spacing.sm, margin: spacing.md }]}>
          <Text style={styles.subtitle}>{found ? "Finish earlier lessons first" : "Lesson not found"}</Text>
          <Pressable style={[styles.btnPrimary, { alignSelf: "stretch" }]} onPress={() => router.dismissTo("/")}>
            <Text style={styles.btnPrimaryText}>Back to course</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const practice = progress.completedLessonIds.includes(found.lesson.id);
  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <LessonPlayer key={found.lesson.id} lesson={found.lesson} practice={practice} />
    </SafeAreaView>
  );
}
