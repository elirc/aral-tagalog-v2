"use client";

import Link from "next/link";
import { Header } from "@/components/Header";
import { bundle } from "@/lib/content";
import { useProgress } from "@/lib/progress";

export default function CourseMapPage() {
  const { progress, ready, user } = useProgress();
  const done = new Set(progress.completedLessonIds);

  // the "next" lesson is the first uncompleted one in course order
  let nextFound = false;

  return (
    <>
      <Header />
      <main className="container">
        {!ready ? null : (
          <>
            {!user && (
              <p style={{ color: "var(--text-muted)", fontSize: 15 }}>
                Playing as guest — <Link href="/register">create a free account</Link> to save progress across
                devices.
              </p>
            )}
            {bundle.units.map((unit, ui) => (
              <section className="unit-card" key={unit.id}>
                <h2 className="unit-title">
                  Unit {ui + 1}: {unit.title}
                </h2>
                {unit.description && <p className="unit-desc">{unit.description}</p>}
                {unit.lessons.map((lesson) => {
                  const isDone = done.has(lesson.id);
                  const isNext = !isDone && !nextFound;
                  if (isNext) nextFound = true;
                  const locked = !isDone && !isNext;
                  return (
                    <div className="lesson-row" key={lesson.id}>
                      <div className={`lesson-dot ${isDone ? "done" : isNext ? "next" : "locked"}`}>
                        {isDone ? "★" : isNext ? "▶" : "🔒"}
                      </div>
                      <span className="lesson-name">{lesson.title}</span>
                      <span className="spacer" />
                      {!locked && (
                        <Link className="btn btn-primary" href={`/lesson/${lesson.id}`}>
                          {isDone ? "Practice" : "Start"}
                        </Link>
                      )}
                    </div>
                  );
                })}
              </section>
            ))}
          </>
        )}
      </main>
    </>
  );
}
