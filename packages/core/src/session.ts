import { grade, type UserAnswer } from "./grading";
import type { Exercise, Lesson } from "./types";

/**
 * Lesson session state machine, pure and immutable so both clients can drive
 * it from a reducer. Wrong answers re-queue the exercise at the end (Duolingo
 * style) until answered correctly; each wrong answer counts one mistake.
 */
export interface SessionState {
  lesson: Lesson;
  /** indices into lesson.exercises still to be answered; head is current */
  queue: number[];
  /** distinct exercises solved (for the progress bar) */
  solved: number;
  mistakes: number;
  /** ids of exercises answered wrong at least once this session (review feed) */
  missedExerciseIds: string[];
  done: boolean;
}

export interface AnswerOutcome {
  state: SessionState;
  correct: boolean;
  correctAnswer: string;
}

export function startSession(lesson: Lesson): SessionState {
  return {
    lesson,
    queue: lesson.exercises.map((_, i) => i),
    solved: 0,
    mistakes: 0,
    missedExerciseIds: [],
    done: lesson.exercises.length === 0,
  };
}

function withMiss(s: SessionState, exerciseId: string): string[] {
  return s.missedExerciseIds.includes(exerciseId)
    ? s.missedExerciseIds
    : [...s.missedExerciseIds, exerciseId];
}

export function currentExercise(s: SessionState): Exercise | null {
  const idx = s.queue[0];
  return idx === undefined ? null : (s.lesson.exercises[idx] ?? null);
}

/**
 * Submit an answer for the current exercise.
 * For match_pairs, pass the number of wrong pairings as `matchMistakes`
 * (the exercise itself always completes; mistakes still cost hearts).
 */
export function submitAnswer(
  s: SessionState,
  answer: UserAnswer,
  matchMistakes = 0,
): AnswerOutcome {
  const ex = currentExercise(s);
  if (!ex || s.done) return { state: s, correct: false, correctAnswer: "" };

  if (ex.type === "match_pairs") {
    const rest = s.queue.slice(1);
    return {
      state: {
        ...s,
        queue: rest,
        solved: s.solved + 1,
        mistakes: s.mistakes + matchMistakes,
        missedExerciseIds: matchMistakes > 0 ? withMiss(s, ex.id) : s.missedExerciseIds,
        done: rest.length === 0,
      },
      correct: matchMistakes === 0,
      correctAnswer: "",
    };
  }

  const result = grade(ex, answer);
  if (result.correct) {
    const rest = s.queue.slice(1);
    return {
      state: { ...s, queue: rest, solved: s.solved + 1, done: rest.length === 0 },
      correct: true,
      correctAnswer: result.correctAnswer,
    };
  }
  // wrong: move to the back of the queue to retry later
  const [head, ...rest] = s.queue;
  return {
    state: {
      ...s,
      queue: [...rest, head!],
      mistakes: s.mistakes + 1,
      missedExerciseIds: withMiss(s, ex.id),
    },
    correct: false,
    correctAnswer: result.correctAnswer,
  };
}

export interface SessionReviewOutcome {
  /** exercises answered wrong at least once — feed the review queue */
  missedExerciseIds: string[];
  /** exercises solved without a single miss — clear them from the queue */
  masteredExerciseIds: string[];
}

/**
 * What this session should report to the progress stream (REV-01): which
 * exercises the user struggled with and which they nailed. Meaningful once
 * the session is done, but safe to call anytime.
 */
export function sessionReviewOutcome(s: SessionState): SessionReviewOutcome {
  const missed = new Set(s.missedExerciseIds);
  const remaining = new Set(s.queue);
  return {
    missedExerciseIds: [...s.missedExerciseIds],
    // only exercises actually solved count — an abandoned session must not
    // "master" exercises the user never reached
    masteredExerciseIds: s.lesson.exercises
      .filter((ex, i) => !remaining.has(i) && !missed.has(ex.id))
      .map((ex) => ex.id),
  };
}

export function sessionProgress(s: SessionState): number {
  const total = s.lesson.exercises.length;
  return total === 0 ? 1 : s.solved / total;
}

export function isPerfect(s: SessionState): boolean {
  return s.done && s.mistakes === 0;
}
