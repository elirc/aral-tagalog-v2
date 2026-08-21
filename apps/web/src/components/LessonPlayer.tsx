"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ACHIEVEMENTS,
  COMBO_MIN,
  currentExercise,
  earnedAchievementIds,
  isPerfect,
  lessonXp,
  levelForXp,
  localDayKey,
  MAX_HEARTS,
  msUntilNextHeart,
  PRACTICE_XP,
  questStatuses,
  reduceEvents,
  regenerate,
  sessionProgress,
  sessionReviewOutcome,
  sessionXp,
  startSession,
  submitAnswer,
  todayStats,
  type Lesson,
  type ProgressEvent,
  type QuestStatus,
  type SessionState,
  type UserAnswer,
} from "@aral/core";
import { playAudio } from "@/lib/audio";
import { bundle } from "@/lib/content";
import { deviceTz, newEventId, useProgress } from "@/lib/progress";

interface CompletionSummary {
  xp: number;
  /** how much of `xp` came from the combo (shown separately on the summary) */
  comboXp: number;
  perfect: boolean;
  todayXp: number;
  goal: number;
  goalMet: boolean;
  /** achievement ids newly unlocked by this completion */
  newlyUnlocked: string[];
  /** the level just reached, when this completion crossed a threshold */
  leveledUpTo: number | null;
  /** daily quests this completion finished off (GAM) */
  questsCompleted: QuestStatus[];
}
import { ArrangeView } from "./exercises/ArrangeView";
import { ChoiceView } from "./exercises/ChoiceView";
import { DialogueView } from "./exercises/DialogueView";
import { FillBlankView } from "./exercises/FillBlankView";
import { MatchView } from "./exercises/MatchView";
import { TapsView } from "./exercises/TapsView";

type Phase =
  | { kind: "answering" }
  | { kind: "feedback"; correct: boolean; correctAnswer: string; next: SessionState; comboXp: number };

/**
 * Drives a lesson session from @aral/core. `practice` runs (replaying a
 * completed lesson) don't cost hearts and refill one on completion (GAM-03).
 */
export function LessonPlayer({ lesson, practice }: { lesson: Lesson; practice: boolean }) {
  const { progress, addEvents } = useProgress();
  const [session, setSession] = useState<SessionState>(() => startSession(lesson));
  const [phase, setPhase] = useState<Phase>({ kind: "answering" });
  const [answer, setAnswer] = useState<UserAnswer | null>(null);
  const [attempt, setAttempt] = useState(0); // remounts exercise views on retry
  const [summary, setSummary] = useState<CompletionSummary | null>(null);
  const completionSent = useRef(false);
  const continueRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const hearts = regenerate(progress.hearts, Date.now()).hearts;
  const exercise = currentExercise(session);

  // keyboard flow: swapping Check → Continue (and remounting the exercise on
  // advance) would otherwise drop focus to <body> on every transition
  useEffect(() => {
    if (phase.kind === "feedback") continueRef.current?.focus();
    else cardRef.current?.focus();
  }, [phase.kind, attempt]);

  // record the completion event exactly once, and compute the completion summary
  // (goal progress, quests, newly-unlocked achievements) from the projected progress.
  useEffect(() => {
    if (!session.done || completionSent.current) return;
    completionSent.current = true;
    const perfect = isPerfect(session);
    // practice replays earn a flat, smaller award and no combo bonus (server
    // clamps to match); first-time completions add whatever the combo earned
    const xp = sessionXp(session, practice);
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
      maxCombo: session.maxCombo > 0 ? session.maxCombo : undefined,
    };
    // diff earned achievements and finished quests before vs. after folding
    // this completion — the reducer credits quest XP itself, so "what did I
    // just win" is a difference of two derived states, not a separate claim
    const before = new Set(earnedAchievementIds(progress, bundle.units));
    const dayKey = localDayKey(now, tz);
    const questsBefore = new Set(
      questStatuses(dayKey, todayStats(progress, tz, now))
        .filter((q) => q.complete)
        .map((q) => q.def.id),
    );
    const after = reduceEvents([event], tz, now, progress);
    const newlyUnlocked = earnedAchievementIds(after, bundle.units).filter((id) => !before.has(id));
    const questsCompleted = questStatuses(dayKey, todayStats(after, tz, now)).filter(
      (q) => q.complete && !questsBefore.has(q.def.id),
    );
    const todayXp = after.xpByDay[dayKey] ?? 0;
    const levelAfter = levelForXp(after.xpTotal);
    setSummary({
      xp,
      comboXp: practice ? 0 : session.comboBonusXp,
      perfect,
      todayXp,
      goal: after.dailyGoalXp,
      goalMet: todayXp >= after.dailyGoalXp,
      newlyUnlocked,
      leveledUpTo: levelAfter > levelForXp(progress.xpTotal) ? levelAfter : null,
      questsCompleted,
    });
    addEvents([event]);
  }, [session, lesson, practice, addEvents, progress]);

  const check = () => {
    if (!exercise || answer === null || phase.kind !== "answering") return;
    const outcome = submitAnswer(session, answer);
    if (!outcome.correct && !practice) {
      addEvents([{ id: newEventId(), type: "hearts_lost", occurredAt: Date.now(), count: 1 }]);
    }
    if (exercise.audio && outcome.correct) playAudio(exercise.audio);
    setPhase({
      kind: "feedback",
      correct: outcome.correct,
      correctAnswer: outcome.correctAnswer,
      next: outcome.state,
      comboXp: outcome.comboXpGained,
    });
  };

  const advance = () => {
    if (phase.kind !== "feedback") return;
    setSession(phase.next);
    setPhase({ kind: "answering" });
    setAnswer(null);
    setAttempt((n) => n + 1);
  };

  // Enter drives the whole flow from the keyboard: check when an answer is
  // staged, continue from feedback. Footer buttons and text inputs keep their
  // native Enter behavior (double-firing otherwise). The listener is attached
  // once; a ref keeps the handler's closures fresh without re-subscribing
  // every render.
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    if (e.key !== "Enter") return;
    const t = e.target instanceof HTMLElement ? e.target : null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.closest(".player-footer"))) return;
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

  if (session.done) {
    const perfect = isPerfect(session);
    return (
      <div className="center-card">
        <p className="big-emoji">{perfect ? "🏆" : "🎉"}</p>
        <h2>{perfect ? "Perfect lesson!" : "Lesson complete!"}</h2>
        <p>
          +{summary?.xp ?? (practice ? PRACTICE_XP : lessonXp(lesson, perfect))} XP
          {perfect && !practice ? " (includes perfect bonus)" : ""}
          {practice ? " · +1 ❤️ for practicing" : ""}
        </p>
        {summary && summary.comboXp > 0 && (
          <p className="combo-summary">
            🔥 Best combo {session.maxCombo} — <strong>+{summary.comboXp} XP</strong> from the streak of
            correct answers
          </p>
        )}
        {summary?.leveledUpTo && (
          <p className="levelup" role="status">
            ⬆️ Level up! You reached <strong>Lv {summary.leveledUpTo}</strong>
          </p>
        )}
        {summary &&
          (summary.goalMet ? (
            <p className="completion-goal met">Daily goal met! 🎯</p>
          ) : (
            <p className="completion-goal">
              {summary.todayXp}/{summary.goal} XP toward today&apos;s goal
            </p>
          ))}
        {summary && summary.questsCompleted.length > 0 && (
          <div className="unlocked">
            <p className="unlocked-title">
              ✅ Quest{summary.questsCompleted.length > 1 ? "s" : ""} complete!
            </p>
            <div className="unlocked-list">
              {summary.questsCompleted.map((q) => (
                <div className="unlocked-item" key={q.def.id}>
                  <span className="emoji">{q.def.emoji}</span>
                  <span>
                    <span className="t">{q.def.title}</span>
                    <br />
                    <span className="d">
                      {q.def.description} · +{q.def.rewardXp} XP
                    </span>
                  </span>
                </div>
              ))}
            </div>
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
        <Link href="/" className="btn btn-primary" style={{ marginTop: 16 }}>
          Continue
        </Link>
      </div>
    );
  }

  // gate only between exercises: when the last heart is lost, the user must
  // still see the feedback for the mistake that cost it before this screen
  if (!practice && hearts <= 0 && phase.kind === "answering") {
    const ms = msUntilNextHeart(progress.hearts, Date.now());
    return (
      <div className="center-card">
        <p className="big-emoji">💔</p>
        <h2>You're out of hearts</h2>
        <p>Practice a completed lesson to earn one back, or wait for hearts to regenerate.</p>
        {ms !== null && <p className="exercise-hint">Next heart in ~{Math.max(1, Math.ceil(ms / 60_000))} min</p>}
        <Link href="/" className="btn btn-primary">
          Back to course
        </Link>
      </div>
    );
  }

  if (!exercise) return null;

  const completeMatch = (mistakes: number) => {
    const outcome = submitAnswer(session, "", mistakes);
    if (mistakes > 0 && !practice) {
      addEvents([{ id: newEventId(), type: "hearts_lost", occurredAt: Date.now(), count: Math.min(mistakes, hearts) }]);
    }
    setSession(outcome.state);
    setAnswer(null);
    setAttempt((n) => n + 1);
  };

  const disabled = phase.kind === "feedback";
  const key = `${exercise.id}-${attempt}`;

  return (
    <div>
      <div className="player-top">
        <Link href="/" aria-label="quit lesson" style={{ fontSize: 22, color: "var(--text-muted)" }}>
          ✕
        </Link>
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
        <span className="hearts">
          {practice ? "practice" : `❤️ ${hearts}/${MAX_HEARTS}`}
        </span>
      </div>

      {/* the combo only appears once it is actually paying XP, so it reads as a
          reward rather than a counter that has always been there */}
      {session.combo >= COMBO_MIN && (
        <p className="combo-badge" role="status" aria-live="polite">
          🔥 Combo ×{session.combo}
          {!practice && <span> · +1 XP each</span>}
        </p>
      )}

      <div className="exercise-card" ref={cardRef} tabIndex={-1}>
        {exercise.type === "choice" && (
          <ChoiceView key={key} exercise={exercise} onAnswerChange={setAnswer} disabled={disabled} />
        )}
        {(exercise.type === "translate_taps" || exercise.type === "listen") && (
          <TapsView key={key} exercise={exercise} onAnswerChange={setAnswer} disabled={disabled} />
        )}
        {exercise.type === "arrange" && (
          <ArrangeView key={key} exercise={exercise} onAnswerChange={setAnswer} disabled={disabled} />
        )}
        {exercise.type === "dialogue" && (
          <DialogueView key={key} exercise={exercise} onAnswerChange={setAnswer} disabled={disabled} />
        )}
        {exercise.type === "fill_blank" && (
          <FillBlankView key={key} exercise={exercise} onAnswerChange={setAnswer} disabled={disabled} onSubmit={check} />
        )}
        {exercise.type === "match_pairs" && <MatchView key={key} exercise={exercise} onComplete={completeMatch} />}
      </div>

      {exercise.type !== "match_pairs" && (
        <div
          aria-live="polite"
          className={`player-footer ${phase.kind === "feedback" ? (phase.correct ? "correct" : "wrong") : "neutral"}`}
        >
          {phase.kind === "feedback" ? (
            <>
              <p className="result-line">
                {phase.correct ? "Nice!" : "Not quite."}
                {phase.correct && phase.comboXp > 0 && <small>Combo bonus +{phase.comboXp} XP</small>}
                {!phase.correct && phase.correctAnswer && <small>Correct answer: {phase.correctAnswer}</small>}
              </p>
              <button ref={continueRef} className="btn btn-primary btn-block" onClick={advance}>
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
    </div>
  );
}
