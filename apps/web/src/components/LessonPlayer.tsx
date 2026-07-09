"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  currentExercise,
  isPerfect,
  lessonXp,
  MAX_HEARTS,
  regenerate,
  sessionProgress,
  startSession,
  submitAnswer,
  type Lesson,
  type SessionState,
  type UserAnswer,
} from "@aral/core";
import { playAudio } from "@/lib/audio";
import { newEventId, useProgress } from "@/lib/progress";
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
export function LessonPlayer({ lesson, practice }: { lesson: Lesson; practice: boolean }) {
  const { progress, addEvents } = useProgress();
  const [session, setSession] = useState<SessionState>(() => startSession(lesson));
  const [phase, setPhase] = useState<Phase>({ kind: "answering" });
  const [answer, setAnswer] = useState<UserAnswer | null>(null);
  const [attempt, setAttempt] = useState(0); // remounts exercise views on retry
  const completionSent = useRef(false);

  const hearts = regenerate(progress.hearts, Date.now()).hearts;
  const exercise = currentExercise(session);

  // record the completion event exactly once
  useEffect(() => {
    if (!session.done || completionSent.current) return;
    completionSent.current = true;
    addEvents([
      {
        id: newEventId(),
        type: "lesson_completed",
        lessonId: lesson.id,
        occurredAt: Date.now(),
        perfect: isPerfect(session),
        xp: lessonXp(lesson, isPerfect(session)),
        practice: practice || undefined,
      },
    ]);
  }, [session, lesson, practice, addEvents]);

  if (session.done) {
    const perfect = isPerfect(session);
    return (
      <div className="center-card">
        <p className="big-emoji">{perfect ? "🏆" : "🎉"}</p>
        <h2>{perfect ? "Perfect lesson!" : "Lesson complete!"}</h2>
        <p>
          +{lessonXp(lesson, perfect)} XP{perfect ? " (includes perfect bonus)" : ""}
          {practice ? " · +1 ❤️ for practicing" : ""}
        </p>
        <Link href="/" className="btn btn-primary">
          Continue
        </Link>
      </div>
    );
  }

  if (!practice && hearts <= 0) {
    return (
      <div className="center-card">
        <p className="big-emoji">💔</p>
        <h2>You're out of hearts</h2>
        <p>Practice a completed lesson to earn one back, or wait for hearts to regenerate.</p>
        <Link href="/" className="btn btn-primary">
          Back to course
        </Link>
      </div>
    );
  }

  if (!exercise) return null;

  const check = () => {
    if (answer === null) return;
    const outcome = submitAnswer(session, answer);
    if (!outcome.correct && !practice) {
      addEvents([{ id: newEventId(), type: "hearts_lost", occurredAt: Date.now(), count: 1 }]);
    }
    if (exercise.audio && outcome.correct) playAudio(exercise.audio);
    setPhase({ kind: "feedback", correct: outcome.correct, correctAnswer: outcome.correctAnswer, next: outcome.state });
  };

  const completeMatch = (mistakes: number) => {
    const outcome = submitAnswer(session, "", mistakes);
    if (mistakes > 0 && !practice) {
      addEvents([{ id: newEventId(), type: "hearts_lost", occurredAt: Date.now(), count: Math.min(mistakes, hearts) }]);
    }
    setSession(outcome.state);
    setAnswer(null);
    setAttempt((n) => n + 1);
  };

  const advance = () => {
    if (phase.kind !== "feedback") return;
    setSession(phase.next);
    setPhase({ kind: "answering" });
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
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${sessionProgress(session) * 100}%` }} />
        </div>
        <span className="hearts">
          {practice ? "practice" : `❤️ ${hearts}/${MAX_HEARTS}`}
        </span>
      </div>

      <div className="exercise-card">
        {exercise.type === "choice" && (
          <ChoiceView key={key} exercise={exercise} onAnswerChange={setAnswer} disabled={disabled} />
        )}
        {(exercise.type === "translate_taps" || exercise.type === "listen") && (
          <TapsView key={key} exercise={exercise} onAnswerChange={setAnswer} disabled={disabled} />
        )}
        {exercise.type === "fill_blank" && (
          <FillBlankView key={key} exercise={exercise} onAnswerChange={setAnswer} disabled={disabled} />
        )}
        {exercise.type === "match_pairs" && <MatchView key={key} exercise={exercise} onComplete={completeMatch} />}
      </div>

      {exercise.type !== "match_pairs" && (
        <div className={`player-footer ${phase.kind === "feedback" ? (phase.correct ? "correct" : "wrong") : "neutral"}`}>
          {phase.kind === "feedback" ? (
            <>
              <p className="result-line">
                {phase.correct ? "Nice!" : "Not quite."}
                {!phase.correct && phase.correctAnswer && <small>Correct answer: {phase.correctAnswer}</small>}
              </p>
              <button className="btn btn-primary btn-block" onClick={advance}>
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
