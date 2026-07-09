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
    done: lesson.exercises.length === 0,
  };
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
    state: { ...s, queue: [...rest, head!], mistakes: s.mistakes + 1 },
    correct: false,
    correctAnswer: result.correctAnswer,
  };
}

export function sessionProgress(s: SessionState): number {
  const total = s.lesson.exercises.length;
  return total === 0 ? 1 : s.solved / total;
}

export function isPerfect(s: SessionState): boolean {
  return s.done && s.mistakes === 0;
}
