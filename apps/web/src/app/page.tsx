"use client";

import { useClock } from "@/lib/use-clock";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  findNextLesson,
  matchesSearch,
  DEFAULT_DAILY_GOAL_XP,
  displayStreak,
  playableLessonIds,
  localDayKey,
  PRACTICE_XP,
  tierStatuses,
  type TierStatus,
  type UnitOverview,
} from "@aral/core";
import { Header } from "@/components/Header";
import { QuestPanel } from "@/components/QuestPanel";
import { TierPlacement } from "@/components/TierPlacement";
import { bundle } from "@/lib/content";
import { deviceTz, useProgress } from "@/lib/progress";

const UNIT_COLORS = ["#4a8f00", "#1cb0f6", "#ce82ff", "#ff9600", "#ff4b4b", "#2bb6a3"];

export default function CourseMapPage() {
  const { progress, ready, user } = useProgress();
  const clockNow = useClock();
  const [selectedTier, setSelectedTier] = useState("");
  const done = useMemo(() => new Set(progress.completedLessonIds), [progress.completedLessonIds]);
  const next = useMemo(() => findNextLesson(bundle.units, progress.completedLessonIds, {
    tiers: bundle.tiers, unlockedTierIds: progress.unlockedTierIds,
  }, selectedTier || undefined), [progress.completedLessonIds, progress.unlockedTierIds, selectedTier]);

  const tz = deviceTz();
  const now = clockNow;
  const todayXp = progress.xpByDay[localDayKey(now, tz)] ?? 0;
  const goal = progress.dailyGoalXp || DEFAULT_DAILY_GOAL_XP;
  const streak = displayStreak(progress.streak, localDayKey(now, tz));
  const started = progress.lessonsCompleted > 0;
  // Exact current exercise IDs are resolved lazily when review starts.
  const hasReview = progress.weakExerciseIds.length > 0;
  const available = useMemo(() => playableLessonIds(bundle.units, progress.completedLessonIds, {
    tiers: bundle.tiers, unlockedTierIds: progress.unlockedTierIds,
  }), [progress.completedLessonIds, progress.unlockedTierIds]);
  const tiers = useMemo(() => tierStatuses(bundle.units, progress.completedLessonIds, {
    tiers: bundle.tiers, unlockedTierIds: progress.unlockedTierIds,
  }), [progress.completedLessonIds, progress.unlockedTierIds]);

  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="container">
        {!ready ? <p role="status">Loading your course…</p> : (
          <>
            <h1 className="page-title">Learn Tagalog</h1>
            <p className="page-sub">Small lessons. A little progress every day.</p>
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

            <QuestPanel progress={progress} />

            {hasReview && (
              <Link href="/lesson/review" className="review-banner">
                <span className="review-emoji" aria-hidden>
                  🧹
                </span>
                <span className="review-text">
                  <strong>Review your mistakes</strong>
                  <span>
                    Practice saved mistakes · +{PRACTICE_XP} XP
                    · +1 ❤️
                  </span>
                </span>
                <span className="btn btn-primary">Review</span>
              </Link>
            )}

            <TierPlacement progress={progress} onPlace={setSelectedTier} />

            {tiers.length > 0 && (
              <div className="course-toolbar">
                <label htmlFor="course-track">Explore a track</label>
                <select id="course-track" value={selectedTier || next?.unit.tier || tiers[0]!.tier.id}
                  onChange={(event) => setSelectedTier(event.target.value)}>
                  {tiers.map((status) => <option key={status.tier.id} value={status.tier.id}>
                    {status.tier.title}{status.unlocked ? "" : " · Locked"}
                  </option>)}
                </select>
              </div>
            )}
            {tiers.length > 0 ? (
              tiers.filter((status) => status.tier.id === (selectedTier || next?.unit.tier || tiers[0]!.tier.id)).map((status) => (
                <TierSection
                  key={status.tier.id}
                  status={status}
                  done={done}
                  available={available}
                  nextLessonId={next?.lesson.id ?? null}
                  currentUnitId={next?.unit.id ?? null}
                />
              ))
            ) : (
              // flat bundle (no tiers authored): render units straight through
              <UnitList
                key={next?.unit.id ?? "complete"}
                units={bundle.units}
                offset={0}
                done={done}
                available={available}
                nextLessonId={next?.lesson.id ?? null}
                currentUnitId={next?.unit.id ?? null}
              />
            )}
          </>
        )}
      </main>
    </>
  );
}

/** One difficulty track: a header with its own progress, then its units. */
function TierSection({
  status,
  done,
  available,
  nextLessonId,
  currentUnitId,
}: {
  status: TierStatus;
  done: Set<string>;
  available: Set<string>;
  nextLessonId: string | null;
  currentUnitId: string | null;
}) {
  const units = useMemo(() => bundle.units.filter((u) => u.tier === status.tier.id), [status.tier.id]);
  // the compiler rejects empty tiers, but a hand-edited bundle should not crash
  if (units.length === 0) return null;
  const offset = bundle.units.indexOf(units[0]!);
  const color = status.tier.color ?? "var(--accent)";
  const complete = status.lessonsTotal > 0 && status.lessonsDone === status.lessonsTotal;

  return (
    <section className={`tier ${status.unlocked ? "" : "locked"}`}>
      <header className="tier-head" style={{ borderColor: color }}>
        <div className="tier-head-main">
          <h2 className="tier-title">
            {!status.unlocked && <span aria-hidden>🔒 </span>}
            {status.tier.title}
            {complete && <span className="tier-done-tag">★ done</span>}
          </h2>
          {status.tier.description && <p className="tier-desc">{status.tier.description}</p>}
        </div>
        <div className="tier-meta">
          <span className="progress-track thin">
            <span
              className="progress-fill"
              style={{ width: `${status.fraction * 100}%`, display: "block", background: color }}
            />
          </span>
          <span className="tier-count">
            {status.lessonsDone}/{status.lessonsTotal} lessons
          </span>
        </div>
      </header>

      {status.unlocked ? (
        <UnitList
          key={currentUnitId ?? "complete"}
          units={units}
          offset={offset}
          done={done}
          available={available}
          nextLessonId={nextLessonId}
          currentUnitId={currentUnitId}
        />
      ) : (
        <p className="tier-locked-note">
          Finish the previous track to unlock these {units.length} units — or jump straight in with
          &ldquo;Not a beginner?&rdquo; above.
          {status.tier.entryHint && <> {status.tier.entryHint}</>}
        </p>
      )}
    </section>
  );
}

function UnitList({
  units,
  offset,
  done,
  available,
  nextLessonId,
  currentUnitId,
}: {
  units: UnitOverview[];
  /** index of the first unit within the whole course, for the numbered badge */
  offset: number;
  done: Set<string>;
  available: Set<string>;
  nextLessonId: string | null;
  currentUnitId: string | null;
}) {
  const pageSize = 12;
  const currentIndex = units.findIndex((unit) => unit.id === currentUnitId);
  const [page, setPage] = useState(() => Math.max(0, Math.floor(currentIndex / pageSize)));
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const filtered = useMemo(() => units.map((unit, index) => ({ unit, index })).filter(({ unit, index }) => {
    const completed = unit.lessons.every((lesson) => done.has(lesson.id));
    return (filter === "all" || (filter === "completed" ? completed : !completed)) &&
      matchesSearch(query, unit.title, unit.description, String(offset + index + 1), ...unit.lessons.map((lesson) => lesson.title));
  }), [units, query, filter, done, offset]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const activePage = Math.min(page, pageCount - 1);
  const start = activePage * pageSize;
  const visibleUnits = filtered.slice(start, start + pageSize);
  return (
    <>
      <div className="course-search">
        <input className="search-input" type="search" aria-label="Search units" placeholder="Search topics, lessons or unit number"
          value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} />
        <select aria-label="Filter units" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(0); }}>
          <option value="all">All units</option><option value="unfinished">Unfinished</option><option value="completed">Completed</option>
        </select>
      </div>
      {(query || filter !== "all") && <p className="page-sub" role="status">{filtered.length} matching units · <button className="text-button" onClick={() => { setQuery(""); setFilter("all"); setPage(Math.max(0, Math.floor(currentIndex / pageSize))); }}>Clear filters</button></p>}
      {filtered.length === 0 && <p className="word-empty">No units found. Try another topic or clear the filters.</p>}
      {filtered.length > pageSize && (
        <nav className="unit-pages" aria-label="Course units">
          <button className="btn btn-ghost" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>
            Previous units
          </button>
          <label className="page-picker">Page <select aria-label="Unit page" value={activePage} onChange={(event) => setPage(Number(event.target.value))}>
            {Array.from({ length: pageCount }, (_, index) => <option key={index} value={index}>{index + 1} of {pageCount}</option>)}
          </select></label>
          <button className="btn btn-ghost" disabled={activePage + 1 >= pageCount} onClick={() => setPage(activePage + 1)}>
            Next units
          </button>
        </nav>
      )}
      {visibleUnits.map(({ unit, index }) => {
        const total = unit.lessons.length;
        const doneCount = unit.lessons.filter((l) => done.has(l.id)).length;
        const pct = total > 0 ? (doneCount / total) * 100 : 0;
        const isCurrent = currentUnitId === unit.id;
        const number = offset + index + 1;
        const color = UNIT_COLORS[(offset + index) % UNIT_COLORS.length];
        return (
          <details className="unit-card" key={unit.id} open={isCurrent}>
            <summary>
              <span className="unit-badge" style={{ background: color }} aria-hidden>
                {number}
              </span>
              <span className="unit-head-main">
                <h3 className="unit-title">{unit.title}</h3>
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
              <UnitLessons
                unit={unit}
                done={done}
                available={available}
                nextLessonId={nextLessonId}
              />
            </div>
          </details>
        );
      })}
    </>
  );
}

function UnitLessons({
  unit,
  done,
  available,
  nextLessonId,
}: {
  unit: UnitOverview;
  done: Set<string>;
  available: Set<string>;
  nextLessonId: string | null;
}) {
  return (
    <>
      {unit.lessons.map((lesson) => {
        const isDone = done.has(lesson.id);
        const isNext = lesson.id === nextLessonId;
        const locked = !available.has(lesson.id);
        return (
          <div className="lesson-row" key={lesson.id}>
            <div className={`lesson-dot ${isDone ? "done" : isNext ? "next" : locked ? "locked" : "open"}`}>
              {isDone ? "★" : isNext ? "▶" : locked ? "🔒" : "○"}
            </div>
            <span className="lesson-name">{lesson.title}</span>
            <span className="spacer" />
            {!locked && (
              <Link prefetch={false} className="btn btn-primary" href={`/lesson/${lesson.id}`}>
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
