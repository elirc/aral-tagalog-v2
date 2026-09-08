"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { REVIEW_LESSON_ID, type Lesson } from "@aral/core";
import { ContentLoadError } from "@/components/ContentLoadError";
import { LessonPlayer } from "@/components/LessonPlayer";
import { findLesson, isLessonUnlocked, loadLesson, loadReview } from "@/lib/content";
import { useProgress } from "@/lib/progress";

export default function LessonPage() {
  const lessonId = useParams<{ lessonId: string }>()?.lessonId;
  const { user } = useProgress();
  if (!lessonId) return <main id="main-content" tabIndex={-1} className="container" role="status">Loading lesson…</main>;
  return <LessonContent key={`${user?.id ?? "guest"}:${lessonId}`} lessonId={lessonId} />;
}

function LessonContent({ lessonId }: { lessonId: string }) {
  const { progress, ready } = useProgress();
  const isReview = lessonId === REVIEW_LESSON_ID;
  const found = isReview ? null : findLesson(lessonId);
  const unlocked = isReview || Boolean(found && isLessonUnlocked(lessonId, progress.completedLessonIds, progress.unlockedTierIds));
  const entry = useRef<{ practice: boolean; weakIds: string[] } | null>(null);
  const [loaded, setLoaded] = useState<{ lesson: Lesson | null } | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  // Snapshot intent once. Sync/completion can change progress while a public file loads.
  if (ready && unlocked && !entry.current) {
    entry.current = { practice: isReview || progress.completedLessonIds.includes(lessonId), weakIds: [...progress.weakExerciseIds] };
  }

  useEffect(() => {
    if (!ready || !unlocked || !entry.current) return;
    let active = true;
    setError(false);
    const pending = isReview ? loadReview(entry.current.weakIds) : loadLesson(lessonId);
    void pending.then((lesson) => { if (active) setLoaded({ lesson }); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [lessonId, ready, unlocked, isReview, retry]);

  useEffect(() => {
    document.title = isReview ? "Review mistakes — Aral" : found ? `${found.lesson.title} · ${found.unitTitle} — Aral` : "Lesson — Aral";
  }, [lessonId, isReview, found?.lesson.title, found?.unitTitle]);

  let content;
  if (!ready) content = <p role="status">Loading your progress…</p>;
  else if (!isReview && !found) content = <div className="center-card"><h2>Lesson not found</h2><Link href="/" className="btn btn-primary">Back to course</Link></div>;
  else if (!unlocked) content = <div className="center-card"><p className="big-emoji">🔒</p><h2>Finish earlier lessons first</h2><Link href="/" className="btn btn-primary">Back to course</Link></div>;
  else if (error) content = <ContentLoadError title="Could not load this lesson" retryLabel="Retry lesson" onRetry={() => setRetry((n) => n + 1)} />;
  else if (!loaded) content = <div className="center-card" role="status"><h2>{isReview ? "Preparing your review…" : found?.lesson.title}</h2><p>Loading lesson…</p></div>;
  else if (!loaded.lesson) content = <div className="center-card"><p className="big-emoji">🧹</p><h2>Nothing to review</h2><p>Mistakes from lessons in this course collect here so you can practice them again.</p><Link href="/" className="btn btn-primary">Back to course</Link></div>;
  else content = <LessonPlayer key={lessonId} lesson={loaded.lesson} practice={entry.current!.practice} />;
  return <main id="main-content" tabIndex={-1} className="container">{content}</main>;
}
