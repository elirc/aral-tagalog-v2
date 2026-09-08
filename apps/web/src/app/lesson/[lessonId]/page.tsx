"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { buildReviewLesson, REVIEW_LESSON_ID, type Lesson } from "@aral/core";
import { LessonPlayer } from "@/components/LessonPlayer";
import { bundle, findLesson, isLessonUnlocked } from "@/lib/content";
import { useProgress } from "@/lib/progress";

export default function LessonPage() {
  const lessonId = useParams<{ lessonId: string }>()?.lessonId;
  const { user } = useProgress();
  if (!lessonId) return <main id="main-content" tabIndex={-1} className="container" role="status">Loading lesson...</main>;
  return <LessonContent key={`${user?.id ?? "guest"}:${lessonId}`} lessonId={lessonId} />;
}

function LessonContent({ lessonId }: { lessonId: string }) {
  const { progress, ready } = useProgress();

  const isReview = lessonId === REVIEW_LESSON_ID;
  const found = isReview ? null : findLesson(lessonId);
  // Capture the review lesson once: completing it clears ids from
  // weakExerciseIds, and a live recompute would yank the completion screen
  // away (or reshuffle exercises) mid-session.
  const reviewRef = useRef<Lesson | null | undefined>(undefined);
  const practiceRef = useRef<boolean | null>(null);
  if (isReview && ready && reviewRef.current === undefined) {
    reviewRef.current = buildReviewLesson(bundle.units, progress.weakExerciseIds);
  }
  const reviewLesson = isReview ? (reviewRef.current ?? null) : null;
  const lesson = isReview ? reviewLesson : (found?.lesson ?? null);

  useEffect(() => {
    if (!lesson) return;
    document.title = isReview
      ? "Review mistakes — Aral"
      : `${lesson.title} · ${found?.unitTitle} — Aral`;
  }, [lesson, isReview, found?.unitTitle]);

  if (!ready) return <main id="main-content" tabIndex={-1} className="container"><p role="status">Loading your lesson?</p></main>;

  if (isReview && !reviewLesson) {
    return (
      <main id="main-content" tabIndex={-1} className="container">
        <div className="center-card">
          <p className="big-emoji">🧹</p>
          <h2>Nothing to review</h2>
          <p>Mistakes you make in lessons collect here so you can practice them again.</p>
          <Link href="/" className="btn btn-primary">Back to course</Link>
        </div>
      </main>
    );
  }

  if (!lesson) {
    return (
      <main id="main-content" tabIndex={-1} className="container">
        <div className="center-card">
          <h2>Lesson not found</h2>
          <Link href="/" className="btn btn-primary">Back to course</Link>
        </div>
      </main>
    );
  }

  if (!isReview && !isLessonUnlocked(lessonId, progress.completedLessonIds, progress.unlockedTierIds)) {
    return (
      <main id="main-content" tabIndex={-1} className="container">
        <div className="center-card">
          <p className="big-emoji">🔒</p>
          <h2>Finish earlier lessons first</h2>
          <Link href="/" className="btn btn-primary">Back to course</Link>
        </div>
      </main>
    );
  }

  // Review sessions are always practice: no hearts lost, one refilled at the
  // end. Frozen at entry — completing the lesson adds it to completedLessonIds,
  // which would otherwise flip this to true and rewrite the summary the player
  // is already showing ("+5 XP for practicing" over a first-time completion).
  if (practiceRef.current === null) {
    practiceRef.current = isReview || progress.completedLessonIds.includes(lessonId);
  }
  const practice = practiceRef.current;
  return (
    <main id="main-content" tabIndex={-1} className="container">
      <LessonPlayer key={lessonId} lesson={lesson} practice={practice} />
    </main>
  );
}
