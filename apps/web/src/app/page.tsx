"use client";

import Link from "next/link";
import {
  buildReviewLesson,
  DEFAULT_DAILY_GOAL_XP,
  displayStreak,
  localDayKey,
  PRACTICE_XP,
  type Lesson,
  type Unit,
} from "@aral/core";
import { Header } from "@/components/Header";
import { bundle } from "@/lib/content";
import { deviceTz, useProgress } from "@/lib/progress";

const UNIT_COLORS = ["#4a8f00", "#1cb0f6", "#ce82ff", "#ff9600", "#ff4b4b", "#2bb6a3"];

function findNext(done: Set<string>): { unit: Unit; lesson: Lesson; unitIndex: number } | null {
  for (let ui = 0; ui < bundle.units.length; ui++) {
    const unit = bundle.units[ui]!;
    const lesson = unit.lessons.find((l) => !done.has(l.id));
    if (lesson) return { unit, lesson, unitIndex: ui };
  }
  return null;
}

export default function CourseMapPage() {
  const { progress, ready, user } = useProgress();
  const done = new Set(progress.completedLessonIds);
  const next = findNext(done);

  const tz = deviceTz();
  const now = Date.now();
  const todayXp = progress.xpByDay[localDayKey(now, tz)] ?? 0;
  const goal = progress.dailyGoalXp || DEFAULT_DAILY_GOAL_XP;
  const streak = displayStreak(progress.streak, localDayKey(now, tz));
  const started = progress.lessonsCompleted > 0;
  // count only mistakes whose exercises still exist in this bundle version
  const reviewable =
    buildReviewLesson(bundle.units, progress.weakExerciseIds, Number.MAX_SAFE_INTEGER)?.exercises
      .length ?? 0;

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

            {/* continue hero: one obvious next action instead of scanning 10 cards */}
            {next ? (
              <section className="hero">
                <div className="hero-body">
                  <p className="hero-kicker">{started ? "Jump back in" : "Start here"}</p>
                  <p className="hero-title">{next.lesson.title}</p>
                  <p className="hero-sub">
                    Unit {next.unitIndex + 1} · {next.unit.title}
                    {streak > 0 && <> · 🔥 {streak}-day streak</>}
                  </p>
                  <Link className="btn btn-primary" href={`/lesson/${next.lesson.id}`}>
                    {started ? "Continue" : "Start learning"} +{next.lesson.xp} XP
                  </Link>
                </div>
                <MiniGoalRing todayXp={todayXp} goal={goal} />
              </section>
            ) : (
              <section className="hero">
                <div className="hero-body">
                  <p className="hero-kicker">Course complete</p>
                  <p className="hero-title">You finished every lesson! 🏆</p>
                  <p className="hero-sub">Replay any lesson below to practice and earn hearts back.</p>
                </div>
                <MiniGoalRing todayXp={todayXp} goal={goal} />
              </section>
            )}

            {reviewable > 0 && (
              <Link href="/lesson/review" className="review-banner">
                <span className="review-emoji" aria-hidden>
                  🧹
                </span>
                <span className="review-text">
                  <strong>Review your mistakes</strong>
                  <span>
                    {reviewable} exercise{reviewable > 1 ? "s" : ""} to practice · +{PRACTICE_XP} XP
                    · +1 ❤️
                  </span>
                </span>
                <span className="btn btn-primary">Review</span>
              </Link>
            )}

            {bundle.units.map((unit, ui) => {
              const total = unit.lessons.length;
              const doneCount = unit.lessons.filter((l) => done.has(l.id)).length;
              const pct = total > 0 ? (doneCount / total) * 100 : 0;
              const isCurrent = next?.unit.id === unit.id;
              const color = UNIT_COLORS[ui % UNIT_COLORS.length];
              return (
                <details className="unit-card" key={unit.id} open={isCurrent}>
                  <summary>
                    <span className="unit-badge" style={{ background: color }} aria-hidden>
                      {ui + 1}
                    </span>
                    <span className="unit-head-main">
                      <h2 className="unit-title">{unit.title}</h2>
                      <span className="unit-head-meta">
                        <span className="progress-track thin">
                          <span
                            className="progress-fill"
                            style={{ width: `${pct}%`, display: "block", background: color }}
                          />
                        </span>
                        <span className="count" style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>
                          {doneCount}/{total}
                        </span>
                      </span>
                    </span>
                    {doneCount === total && <span className="unit-done-tag">★ done</span>}
                    <span className="unit-chevron" aria-hidden>
                      ▼
                    </span>
                  </summary>
                  <div className="unit-body">
                    {unit.description && <p className="unit-desc">{unit.description}</p>}
                    {unit.tip && (
                      <div className="tip-callout">
                        <span className="tip-emoji" aria-hidden>
                          💡
                        </span>
                        <span>{unit.tip}</span>
                      </div>
                    )}
                    <UnitLessons unit={unit} done={done} nextLessonId={next?.lesson.id ?? null} />
                  </div>
                </details>
              );
            })}
          </>
        )}
      </main>
    </>
  );
}

function UnitLessons({
  unit,
  done,
  nextLessonId,
}: {
  unit: Unit;
  done: Set<string>;
  nextLessonId: string | null;
}) {
  return (
    <>
      {unit.lessons.map((lesson) => {
        const isDone = done.has(lesson.id);
        const isNext = lesson.id === nextLessonId;
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
    </>
  );
}

/** Compact daily-goal ring for the hero (full editor lives on /stats). */
function MiniGoalRing({ todayXp, goal }: { todayXp: number; goal: number }) {
  const size = 92;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = goal > 0 ? Math.min(1, todayXp / goal) : 0;
  const met = todayXp >= goal;
  const cx = size / 2;
  return (
    <Link href="/stats" title="daily goal — view stats" className="hero-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${todayXp} of ${goal} XP today`}>
        <circle cx={cx} cy={cx} r={r} fill="none" style={{ stroke: "var(--border)" }} strokeWidth={stroke} />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          style={{ stroke: met ? "var(--warning)" : "var(--primary)", transition: "stroke-dasharray .4s" }}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`}
          transform={`rotate(-90 ${cx} ${cx})`}
        />
        <text x={cx} y={cx - 1} textAnchor="middle" style={{ fontSize: 20, fontWeight: 800, fill: "var(--text)" }}>
          {met ? "🎯" : todayXp}
        </text>
        <text x={cx} y={cx + 16} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: "var(--text-muted)" }}>
          / {goal} XP
        </text>
      </svg>
    </Link>
  );
}
