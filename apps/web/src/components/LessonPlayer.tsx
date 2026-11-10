"use client";

import "./lesson-mobile.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ACHIEVEMENTS,
  currentExercise,
  earnedAchievementIds,
  HEART_REGEN_MS,
  isPerfect,
  lessonXp,
  levelForXp,
  localDayKey,
  MAX_HEARTS,
  msUntilNextHeart,
  PRACTICE_XP,
  reduceEvents,
  regenerate,
  REVIEW_LESSON_ID,
  sessionProgress,
  sessionReviewOutcome,
  startSession,
  submitAnswer,
  type Lesson,
  type ProgressEvent,
  type SessionState,
  type UserAnswer,
} from "@aral/core";
import { playAudio } from "@/lib/audio";
import { bundle, dueReviewCount, findNextLesson } from "@/lib/content";
import { deviceTz, newEventId, useProgress } from "@/lib/progress";
import { ConfirmSheet } from "./ConfirmSheet";

/**
 * Continue is deaf for this long after feedback appears. Check and Continue
 * share one spot under the thumb, so the second tap of a double-tap (or a
 * bouncing Enter) would otherwise skip the verdict unread.
 */
const FEEDBACK_GUARD_MS = 350;

interface CompletionSummary {
  xp: number;
  perfect: boolean;
  todayXp: number;
  goal: number;
  goalMet: boolean;
  /** achievement ids newly unlocked by this completion */
  newlyUnlocked: string[];
  /** the level just reached, when this completion crossed a threshold */
  leveledUpTo: number | null;
}
import { ChoiceView } from "./exercises/ChoiceView";
import { FillBlankView } from "./exercises/FillBlankView";
import { MatchView } from "./exercises/MatchView";
import { TapsView } from "./exercises/TapsView";

type Phase =
  | { kind: "answering" }
  | { kind: "feedback"; correct: boolean; correctAnswer: string; next: SessionState };

/**
 * Drives a lesson session from @aral/core. `practice` runs (replaying a
 * completed lesson) don't cost hearts and refill one on completion (GAM-03).
 */
export function LessonPlayer({
  lesson,
  practice,
  onRestart,
}: {
  lesson: Lesson;
  practice: boolean;
  /**
   * Start a fresh run of this same route. Needed for "review again" from the
   * review lesson: a link to the URL we are already on would do nothing.
   */
  onRestart?: () => void;
}) {
  const router = useRouter();
  const { progress, addEvents } = useProgress();
  const [session, setSession] = useState<SessionState>(() => startSession(lesson));
  const [phase, setPhase] = useState<Phase>({ kind: "answering" });
  const [answer, setAnswer] = useState<UserAnswer | null>(null);
  const [attempt, setAttempt] = useState(0); // remounts exercise views on retry
  const [summary, setSummary] = useState<CompletionSummary | null>(null);
  const [quitOpen, setQuitOpen] = useState(false);
  const completionSent = useRef(false);
  /** when the current feedback banner appeared (see FEEDBACK_GUARD_MS) */
  const feedbackAt = useRef(0);
  const continueRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  /** heading of the completion / out-of-hearts screen (focused on arrival) */
  const endHeadingRef = useRef<HTMLHeadingElement>(null);

  // On phones the footer is pinned to the viewport bottom (lesson-mobile.css).
  // Mirror its live height into --dock-h on the player so the exercise can
  // always scroll clear of it — the feedback banner is taller than the bare
  // Check bar. (React 19 ref callback: the returned cleanup runs on unmount.)
  const dockRef = useCallback((el: HTMLDivElement | null) => {
    const host = el?.parentElement;
    if (!el || !host || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => host.style.setProperty("--dock-h", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => {
      ro.disconnect();
      host.style.removeProperty("--dock-h");
    };
  }, []);

  const hearts = regenerate(progress.hearts, Date.now()).hearts;
  const exercise = currentExercise(session);
  // gate only between exercises: when the last heart is lost, the user must
  // still see the feedback for the mistake that cost it before this screen
  const outOfHearts = !session.done && !practice && hearts <= 0 && phase.kind === "answering";

  // hearts regenerate on a clock, not an event: re-render while gated so the
  // "next heart in ~N min" countdown stays current and the lesson resumes in
  // place once a heart is back (instead of stranding the user on a stale screen)
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!outOfHearts) return;
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [outOfHearts]);

  // Leaving mid-lesson throws the run away (there is no resume), so ask first.
  // Not before the first answer — nothing to lose yet — and not on the
  // out-of-hearts gate, where leaving is the expected next step.
  const inProgress = !session.done && (session.attempts > 0 || phase.kind === "feedback");
  const guardUnload = inProgress && !outOfHearts;
  useEffect(() => {
    if (!guardUnload) return;
    // reload / tab close / typed URL; in-app exits go through the ✕ sheet
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ""; // legacy trigger, still required by some browsers
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [guardUnload]);

  // keyboard / screen-reader flow: swapping Check → Continue, remounting the
  // exercise on advance, and swapping to an end screen would otherwise drop
  // focus to <body> on every transition
  useEffect(() => {
    if (phase.kind === "feedback") {
      // pinned on phones (no scroll); in flow on desktop, where scrolling it
      // into view is exactly what we want
      continueRef.current?.focus();
      return;
    }
    if (endHeadingRef.current) {
      endHeadingRef.current.focus();
      return;
    }
    // each new exercise starts at the top: after scrolling down a long word
    // bank, the next prompt would otherwise open half off-screen on a phone
    if (attempt > 0) window.scrollTo(0, 0);
    cardRef.current?.focus({ preventScroll: true });
  }, [phase.kind, attempt, session.done, outOfHearts]);

  // record the completion event exactly once, and compute the completion summary
  // (goal progress + newly-unlocked achievements) from the projected progress.
  useEffect(() => {
    if (!session.done || completionSent.current) return;
    completionSent.current = true;
    const perfect = isPerfect(session);
    // practice replays earn a flat, smaller award (server clamps to match)
    const xp = practice ? PRACTICE_XP : lessonXp(lesson, perfect);
    const now = Date.now();
    const tz = deviceTz();
    const { missedExerciseIds, masteredExerciseIds } = sessionReviewOutcome(session);
    const event: ProgressEvent = {
      id: newEventId(),
      type: "lesson_completed",
      lessonId: lesson.id,
      occurredAt: now,
      perfect,
      xp,
      practice: practice || undefined,
      missedExerciseIds: missedExerciseIds.length > 0 ? missedExerciseIds : undefined,
      masteredExerciseIds: masteredExerciseIds.length > 0 ? masteredExerciseIds : undefined,
    };
    // diff earned achievements before vs. after folding this completion
    const before = new Set(earnedAchievementIds(progress, bundle.units));
    const after = reduceEvents([event], tz, now, progress);
    const newlyUnlocked = earnedAchievementIds(after, bundle.units).filter((id) => !before.has(id));
    const todayXp = after.xpByDay[localDayKey(now, tz)] ?? 0;
    const levelAfter = levelForXp(after.xpTotal);
    setSummary({
      xp,
      perfect,
      todayXp,
      goal: after.dailyGoalXp,
      goalMet: todayXp >= after.dailyGoalXp,
      newlyUnlocked,
      leveledUpTo: levelAfter > levelForXp(progress.xpTotal) ? levelAfter : null,
    });
    addEvents([event]);
  }, [session, lesson, practice, addEvents, progress]);

  const check = () => {
    if (!exercise || answer === null || phase.kind !== "answering") return;
    const outcome = submitAnswer(session, answer);
    if (!outcome.correct) {
      // exerciseId queues the miss for review right away, so it survives a run
      // that never reaches lesson_completed. Practice / review runs cost no
      // hearts (count 0 folds to no heart change) but still record the miss.
      addEvents([
        {
          id: newEventId(),
          type: "hearts_lost",
          occurredAt: Date.now(),
          count: practice ? 0 : 1,
          exerciseId: exercise.id,
        },
      ]);
    }
    if (exercise.audio && outcome.correct) playAudio(exercise.audio);
    feedbackAt.current = Date.now();
    setPhase({ kind: "feedback", correct: outcome.correct, correctAnswer: outcome.correctAnswer, next: outcome.state });
  };

  const advance = () => {
    if (phase.kind !== "feedback") return;
    if (Date.now() - feedbackAt.current < FEEDBACK_GUARD_MS) return;
    setSession(phase.next);
    setPhase({ kind: "answering" });
    setAnswer(null);
    setAttempt((n) => n + 1);
  };

  // Enter drives the whole flow from the keyboard: check when an answer is
  // staged, continue from feedback. Footer buttons, links and text inputs keep
  // their native Enter behavior (double-firing otherwise). The listener is
  // attached once; a ref keeps the handler's closures fresh without
  // re-subscribing every render.
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    // a held Enter must not chain check → continue → … past the feedback
    if (e.key !== "Enter" || e.repeat) return;
    const t = e.target instanceof HTMLElement ? e.target : null;
    // (the quit button and the confirm sheet's buttons keep native Enter too)
    if (
      t &&
      (t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.closest("a, .player-footer, .player-quit, dialog"))
    )
      return;
    // a focused option / chip / replay button that isn't already the staged
    // pick: let Enter activate it natively. Swallowing it would check the
    // *previous* selection (tab to option 3, press Enter → option 1 graded).
    if (
      phase.kind === "answering" &&
      t instanceof HTMLButtonElement &&
      !t.disabled &&
      t.getAttribute("aria-pressed") !== "true" &&
      // …but not the 🔊 replay button: a mouse click parks focus on it, and
      // Enter must still mean Check (Space replays a focused button natively)
      !t.classList.contains("audio-btn")
    ) {
      return;
    }
    if (phase.kind === "feedback") {
      e.preventDefault();
      advance();
    } else if (answer !== null) {
      e.preventDefault();
      check();
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // --- end screens (completion / out of hearts) share these ---
  const isReview = lesson.id === REVIEW_LESSON_ID;
  /** review action: from the review lesson itself the URL doesn't change, so restart in place */
  const reviewAction = (className: string, label: string) =>
    isReview && onRestart ? (
      <button type="button" className={className} onClick={onRestart}>
        {label}
      </button>
    ) : (
      <Link href={`/lesson/${REVIEW_LESSON_ID}`} className={className}>
        {label}
      </Link>
    );

  if (session.done) {
    const perfect = isPerfect(session);
    const now = Date.now();
    const total = lesson.exercises.length;
    // every exercise ends in one right answer; each mistake was one wrong one
    const accuracy = Math.round((total / Math.max(1, total + session.mistakes)) * 100);
    // `progress` folds this completion in a render after it is sent; adding the
    // id here keeps "next" from pointing back at the lesson just finished
    const next = findNextLesson(new Set([...progress.completedLessonIds, lesson.id]));
    const dueCount = dueReviewCount(progress, now);
    // a regular lesson can't be started on zero hearts — don't make the gate
    // the surprise behind the primary button
    const noHearts = hearts <= 0 && next !== null;
    const showReview = dueCount > 0 && (session.missedExerciseIds.length > 0 || noHearts);
    const reviewFirst = noHearts && showReview;
    const reviewLabel = `Review ${dueCount} mistake${dueCount === 1 ? "" : "s"}`;
    const nextLabel = practice ? "Continue course" : "Next lesson";
    const msToHeart = noHearts ? msUntilNextHeart(progress.hearts, now) : null;
    const goalPct = summary && summary.goal > 0 ? Math.min(100, (summary.todayXp / summary.goal) * 100) : 0;
    return (
      <div className="center-card lesson-end">
        <p className="big-emoji" aria-hidden>
          {perfect ? "🏆" : "🎉"}
        </p>
        <h2 ref={endHeadingRef} tabIndex={-1} style={{ outline: "none" }}>
          {perfect ? "Perfect lesson!" : "Lesson complete!"}
        </h2>
        <p>
          +{practice ? PRACTICE_XP : lessonXp(lesson, perfect)} XP
          {perfect && !practice ? " (includes perfect bonus)" : ""}
          {practice ? " · +1 ❤️ for practicing" : ""}
        </p>
        <p className="end-stats">
          <span>
            <strong>{accuracy}%</strong> accuracy
          </span>
          <span>
            {session.mistakes === 0 ? (
              "No mistakes"
            ) : (
              <>
                <strong>{session.mistakes}</strong> mistake{session.mistakes === 1 ? "" : "s"}
              </>
            )}
          </span>
        </p>
        {summary?.leveledUpTo && (
          <p className="levelup" role="status">
            ⬆️ Level up! You reached <strong>Lv {summary.leveledUpTo}</strong>
          </p>
        )}
        {summary && (
          <div className="end-goal">
            {/* the line below says the same thing in words */}
            <div className={`progress-track end-goal-bar ${summary.goalMet ? "met" : ""}`} aria-hidden>
              <div className="progress-fill" style={{ width: `${goalPct}%` }} />
            </div>
            {summary.goalMet ? (
              <p className="completion-goal met">Daily goal met! 🎯</p>
            ) : (
              <p className="completion-goal">
                {summary.todayXp}/{summary.goal} XP toward today&apos;s goal
              </p>
            )}
          </div>
        )}
        {summary && summary.newlyUnlocked.length > 0 && (
          <div className="unlocked">
            <p className="unlocked-title">
              🎉 New achievement{summary.newlyUnlocked.length > 1 ? "s" : ""} unlocked!
            </p>
            <div className="unlocked-list">
              {summary.newlyUnlocked.map((id) => {
                const a = ACHIEVEMENTS.find((x) => x.id === id);
                if (!a) return null;
                return (
                  <div className="unlocked-item" key={id}>
                    <span className="emoji">{a.emoji}</span>
                    <span>
                      <span className="t">{a.title}</span>
                      <br />
                      <span className="d">{a.description}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {noHearts && (
          <p className="exercise-hint end-note">
            You&apos;re out of hearts, and the next lesson needs one.{" "}
            {showReview
              ? "Reviewing mistakes costs none and earns one back."
              : msToHeart !== null
                ? `Next heart in ~${Math.max(1, Math.ceil(msToHeart / 60_000))} min.`
                : ""}
          </p>
        )}
        <div className="end-actions">
          {next ? (
            <>
              {reviewFirst && reviewAction("btn btn-primary", reviewLabel)}
              <Link href={`/lesson/${next.lesson.id}`} className={reviewFirst ? "btn btn-ghost" : "btn btn-primary"}>
                {nextLabel}
                <span className="end-upnext">{next.lesson.title}</span>
              </Link>
              {showReview && !reviewFirst && reviewAction("btn btn-ghost", reviewLabel)}
              <Link href="/" className="end-link">
                Back to home
              </Link>
            </>
          ) : (
            <>
              <Link href="/" className="btn btn-primary">
                Back to course
              </Link>
              {showReview && reviewAction("btn btn-ghost", reviewLabel)}
            </>
          )}
        </div>
      </div>
    );
  }

  if (outOfHearts) {
    const now = Date.now();
    const ms = msUntilNextHeart(progress.hearts, now);
    // misses are queued for review as they happen (hearts_lost carries the
    // exercise id), so whoever just ran out of hearts normally has some due
    const dueCount = dueReviewCount(progress, now);
    const regenHours = Math.round(HEART_REGEN_MS / 3_600_000);
    return (
      <div className="center-card lesson-end">
        <p className="big-emoji" aria-hidden>
          💔
        </p>
        <h2 ref={endHeadingRef} tabIndex={-1} style={{ outline: "none" }}>
          You&apos;re out of hearts
        </h2>
        <p>
          {dueCount > 0
            ? "Review your mistakes to earn a heart back — reviewing never costs hearts."
            : progress.completedLessonIds.length > 0
              ? "Practice a completed lesson to earn one back, or wait for hearts to refill."
              : `Hearts refill on their own, one every ${regenHours} hours.`}
        </p>
        {ms !== null && <p className="exercise-hint">Next heart in ~{Math.max(1, Math.ceil(ms / 60_000))} min</p>}
        <div className="end-actions">
          {dueCount > 0 ? (
            <>
              <Link href={`/lesson/${REVIEW_LESSON_ID}`} className="btn btn-primary">
                Review your mistakes
                <span className="end-upnext">
                  {dueCount} due · +{PRACTICE_XP} XP · +1 ❤️
                </span>
              </Link>
              <Link href="/" className="btn btn-ghost">
                Back to course
              </Link>
            </>
          ) : (
            <Link href="/" className="btn btn-primary">
              Back to course
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (!exercise) return null;

  const completeMatch = (mistakes: number) => {
    const outcome = submitAnswer(session, "", mistakes);
    if (mistakes > 0) {
      addEvents([
        {
          id: newEventId(),
          type: "hearts_lost",
          occurredAt: Date.now(),
          // practice / review: record the miss for review, cost nothing
          count: practice ? 0 : Math.min(mistakes, hearts),
          exerciseId: exercise.id,
        },
      ]);
    }
    setSession(outcome.state);
    setAnswer(null);
    setAttempt((n) => n + 1);
  };

  const disabled = phase.kind === "feedback";
  const key = `${exercise.id}-${attempt}`;
  // layout seed: constant while this exercise is on screen (`session` only
  // moves on Continue), different when it comes round again after a miss
  const salt = session.attempts;

  return (
    <div className="lesson-player">
      <div className="player-top">
        <button
          type="button"
          aria-label="quit lesson"
          className="player-quit"
          onClick={() => (inProgress ? setQuitOpen(true) : router.push("/"))}
        >
          ✕
        </button>
        <div
          className="progress-track"
          role="progressbar"
          aria-label="lesson progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(sessionProgress(session) * 100)}
        >
          <div className="progress-fill" style={{ width: `${sessionProgress(session) * 100}%` }} />
        </div>
        {/* aria-label on a bare span is unreliable — spoken copy as sr-only text */}
        <span className="hearts">
          <span aria-hidden>{practice ? "practice" : `❤️ ${hearts}/${MAX_HEARTS}`}</span>
          <span className="sr-only">
            {practice ? "practice mode, no hearts used" : `${hearts} of ${MAX_HEARTS} hearts`}
          </span>
        </span>
      </div>

      {/* Always mounted, so screen readers reliably announce each verdict
          (a live region inserted together with its text often isn't read).
          The visible banner below carries the same words, not just a color. */}
      <p className="sr-only" role="status" aria-live="polite">
        {phase.kind === "feedback"
          ? phase.correct
            ? "Correct!"
            : `Not quite.${phase.correctAnswer ? ` Correct answer: ${phase.correctAnswer}` : ""}`
          : ""}
      </p>

      <div className="exercise-card" ref={cardRef} tabIndex={-1}>
        {exercise.type === "choice" && (
          <ChoiceView key={key} exercise={exercise} salt={salt} onAnswerChange={setAnswer} disabled={disabled} />
        )}
        {(exercise.type === "translate_taps" || exercise.type === "listen") && (
          <TapsView key={key} exercise={exercise} salt={salt} onAnswerChange={setAnswer} disabled={disabled} />
        )}
        {exercise.type === "fill_blank" && (
          <FillBlankView key={key} exercise={exercise} salt={salt} onAnswerChange={setAnswer} disabled={disabled} onSubmit={check} />
        )}
        {exercise.type === "match_pairs" && <MatchView key={key} exercise={exercise} salt={salt} onComplete={completeMatch} />}
      </div>

      {exercise.type !== "match_pairs" && (
        <div
          ref={dockRef}
          className={`player-footer ${phase.kind === "feedback" ? (phase.correct ? "correct" : "wrong") : "neutral"}`}
        >
          {phase.kind === "feedback" ? (
            <>
              {/* announced via the status region above; hidden here so it isn't read twice */}
              <p className="result-line" aria-hidden>
                <span className="result-mark">{phase.correct ? "✓" : "✗"}</span>
                {phase.correct ? "Nice!" : "Not quite."}
                {!phase.correct && phase.correctAnswer && <small>Correct answer: {phase.correctAnswer}</small>}
              </p>
              <button
                ref={continueRef}
                className="btn btn-primary btn-block"
                onClick={advance}
                // focus lands here right after an Enter-to-check; a held key
                // would auto-repeat straight past the feedback
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.repeat) e.preventDefault();
                }}
              >
                Continue
              </button>
            </>
          ) : (
            <button className="btn btn-primary btn-block" disabled={answer === null} onClick={check}>
              Check
            </button>
          )}
        </div>
      )}

      <ConfirmSheet
        open={quitOpen}
        title="Quit this lesson?"
        cancelLabel="Keep learning"
        confirmLabel="Quit lesson"
        onCancel={() => setQuitOpen(false)}
        onConfirm={() => {
          setQuitOpen(false);
          router.push("/");
        }}
      >
        <p>
          You&apos;ll lose your place and start this lesson over next time.
          {session.mistakes > 0 ? " The mistakes you made are saved for review." : ""}
        </p>
      </ConfirmSheet>
    </div>
  );
}
