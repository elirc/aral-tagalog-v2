"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { LessonPlayer } from "@/components/LessonPlayer";
import { findLesson, isLessonUnlocked } from "@/lib/content";
import { useProgress } from "@/lib/progress";

export default function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { progress, ready } = useProgress();

  if (!ready) return null;

  const found = findLesson(lessonId);
  if (!found) {
    return (
      <main className="container">
        <div className="center-card">
          <h2>Lesson not found</h2>
          <Link href="/" className="btn btn-primary">Back to course</Link>
        </div>
      </main>
    );
  }

  if (!isLessonUnlocked(lessonId, progress.completedLessonIds)) {
    return (
      <main className="container">
        <div className="center-card">
          <p className="big-emoji">🔒</p>
          <h2>Finish earlier lessons first</h2>
          <Link href="/" className="btn btn-primary">Back to course</Link>
        </div>
      </main>
    );
  }

  const practice = progress.completedLessonIds.includes(lessonId);
  return (
    <main className="container">
      <LessonPlayer key={lessonId} lesson={found.lesson} practice={practice} />
    </main>
  );
}
