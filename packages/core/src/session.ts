import { grade, type UserAnswer } from "./grading";
import type { Exercise, Lesson } from "./types";

/**
 * Lesson session state machine, pure and immutable so both clients can drive
 * it from a reducer. A wrong answer re-queues the exercise a few places
 * further on (see RETRY_GAP) until it is answered correctly; each wrong answer
 * counts one mistake.
 */

/**
 * How many other exercises come between a miss and its retry. Soon enough
 * that the correction is still fresh, far enough that it isn't a copy from
 * short-term memory. With fewer exercises left the retry simply goes last —
 * never back-to-back unless it is the only exercise remaining.
 */
export const RETRY_GAP = 3;

export interface SessionState {
  lesson: Lesson;
  /** indices into lesson.exercises still to be answered; head is current */
  queue: number[];
  /** distinct exercises solved (for the progress bar) */
  solved: number;
  mistakes: number;
  /** ids of exercises answered wrong at least once this session (review feed) */
  missedExerciseIds: string[];
  /**
   * Answers submitted so far, right or wrong. Changes every time an exercise
   * comes round again, so clients pass it to presentationOrder as the salt —
   * a retry is then laid out differently from the attempt that was missed.
   */
  attempts: number;
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
    attempts: 0,
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

  // `?? 0`: tolerate a session object created before the field existed
  const attempts = (s.attempts ?? 0) + 1;

  if (ex.type === "match_pairs") {
    const rest = s.queue.slice(1);
    return {
      state: {
        ...s,
        queue: rest,
        solved: s.solved + 1,
        mistakes: s.mistakes + matchMistakes,
        missedExerciseIds: matchMistakes > 0 ? withMiss(s, ex.id) : s.missedExerciseIds,
        attempts,
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
      state: { ...s, queue: rest, solved: s.solved + 1, attempts, done: rest.length === 0 },
      correct: true,
      correctAnswer: result.correctAnswer,
    };
  }
  // wrong: retry after RETRY_GAP other exercises (or last, if fewer remain)
  const [head, ...rest] = s.queue;
  const at = Math.min(RETRY_GAP, rest.length);
  return {
    state: {
      ...s,
      queue: [...rest.slice(0, at), head!, ...rest.slice(at)],
      attempts,
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
