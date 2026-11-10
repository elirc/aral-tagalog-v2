"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { buildReviewLesson, dueReviewIds, nextReviewAt, REVIEW_LESSON_ID, type Lesson } from "@aral/core";
import { LessonPlayer } from "@/components/LessonPlayer";
import { bundle, findLesson, isLessonUnlocked } from "@/lib/content";
import { useProgress } from "@/lib/progress";
import "../../pages-mobile.css";

export default function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  // bumped by "review again": same URL, but it must be a brand-new run
  const [run, setRun] = useState(0);
  // LessonRun freezes its lesson and practice flag per mount, so every run —
  // another lesson reached from the completion screen, the review route from
  // the out-of-hearts gate, a restarted review — has to be a fresh mount.
  // Keying here guarantees it however the router reuses this page component.
  return <LessonRun key={`${lessonId}#${run}`} lessonId={lessonId} onRestart={() => setRun((n) => n + 1)} />;
}

function LessonRun({ lessonId, onRestart }: { lessonId: string; onRestart: () => void }) {
  const { progress, ready } = useProgress();

  const isReview = lessonId === REVIEW_LESSON_ID;
  const found = isReview ? null : findLesson(lessonId);
  // Capture the review lesson once: completing it clears ids from the due
  // queue (and a miss re-queues one), and a live recompute would yank the
  // completion screen away (or reshuffle exercises) mid-session.
  const reviewRef = useRef<Lesson | null | undefined>(undefined);
  const practiceRef = useRef<boolean | null>(null);
  if (isReview && ready && reviewRef.current === undefined) {
    reviewRef.current = buildReviewLesson(bundle.units, dueReviewIds(progress, Date.now()));
  }
  const reviewLesson = isReview ? (reviewRef.current ?? null) : null;
  const lesson = isReview ? reviewLesson : (found?.lesson ?? null);

  useEffect(() => {
    if (!lesson) return;
    const prev = document.title;
    document.title = isReview
      ? "Review mistakes — Aral"
      : `${lesson.title} · ${found?.unitTitle} — Aral`;
    // client nav away keeps the DOM <title> unless someone puts it back
    return () => {
      document.title = prev;
    };
  }, [lesson, isReview, found?.unitTitle]);

  // the pre-hydration HTML (and any progress-loading moment) still needs a
  // landmark and heading — an empty body reads as a broken page to AT
  const srTitle = isReview ? "Review mistakes" : (found?.lesson.title ?? "Lesson");
  if (!ready) {
    return (
      <main id="main" className="container">
        <h1 className="sr-only">{srTitle}</h1>
      </main>
    );
  }

  if (isReview && !reviewLesson) {
    // cleared mistakes come back on a spaced schedule — say when, or an empty
    // queue reads as "review is finished for good"
    const nextAt = nextReviewAt(progress, Date.now());
    const hoursAway = nextAt === null ? null : Math.max(1, Math.round((nextAt - Date.now()) / 3_600_000));
    return (
      <main id="main" className="container">
        <div className="center-card">
          <p className="big-emoji">🧹</p>
          <h1>Nothing to review</h1>
          <p>Mistakes you make in lessons collect here so you can practice them again.</p>
          {hoursAway !== null && (
            <p className="exercise-hint">
              Next review in about{" "}
              {hoursAway < 24
                ? `${hoursAway} hour${hoursAway === 1 ? "" : "s"}`
                : `${Math.round(hoursAway / 24)} day${Math.round(hoursAway / 24) === 1 ? "" : "s"}`}
              .
            </p>
          )}
          <div className="page-actions">
            <Link href="/" className="btn btn-primary">Back to course</Link>
          </div>
        </div>
      </main>
    );
  }

  if (!lesson) {
    return (
      <main id="main" className="container">
        <div className="center-card">
          <h1>Lesson not found</h1>
          <div className="page-actions">
            <Link href="/" className="btn btn-primary">Back to course</Link>
          </div>
        </div>
      </main>
    );
  }

  if (!isReview && !isLessonUnlocked(lessonId, progress.completedLessonIds)) {
    return (
      <main id="main" className="container">
        <div className="center-card">
          <p className="big-emoji">🔒</p>
          <h1>Finish earlier lessons first</h1>
          <div className="page-actions">
            <Link href="/" className="btn btn-primary">Back to course</Link>
          </div>
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
    <main id="main" className="container">
      <h1 className="sr-only">{srTitle}</h1>
      <LessonPlayer lesson={lesson} practice={practice} onRestart={onRestart} />
    </main>
  );
}
