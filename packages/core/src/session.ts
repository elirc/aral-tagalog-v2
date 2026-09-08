import { grade, type UserAnswer } from "./grading";
import type { Exercise, Lesson } from "./types";
import { COMBO_MIN, lessonXp, MAX_COMBO_BONUS_XP, PRACTICE_XP } from "./xp";

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
  /** consecutive correct answers right now; a miss resets it to 0 */
  combo: number;
  /** best run this session — reported to the progress stream for quests */
  maxCombo: number;
  /** XP the combo has earned so far, capped at MAX_COMBO_BONUS_XP */
  comboBonusXp: number;
  done: boolean;
}

export interface AnswerOutcome {
  state: SessionState;
  correct: boolean;
  correctAnswer: string;
  /** XP the combo awarded for *this* answer (0 unless the run is hot) */
  comboXpGained: number;
}

export function startSession(lesson: Lesson): SessionState {
  return {
    lesson,
    queue: lesson.exercises.map((_, i) => i),
    solved: 0,
    mistakes: 0,
    missedExerciseIds: [],
    combo: 0,
    maxCombo: 0,
    comboBonusXp: 0,
    done: lesson.exercises.length === 0,
  };
}

function withMiss(s: SessionState, exerciseId: string): string[] {
  return s.missedExerciseIds.includes(exerciseId)
    ? s.missedExerciseIds
    : [...s.missedExerciseIds, exerciseId];
}

/** Combo fields after one correct answer (bonus starts at COMBO_MIN, capped). */
function advanceCombo(s: SessionState): { combo: number; maxCombo: number; comboBonusXp: number; gained: number } {
  const combo = s.combo + 1;
  const gained = combo >= COMBO_MIN ? Math.max(0, Math.min(1, MAX_COMBO_BONUS_XP - s.comboBonusXp)) : 0;
  return {
    combo,
    maxCombo: Math.max(s.maxCombo, combo),
    comboBonusXp: s.comboBonusXp + gained,
    gained,
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
  if (!ex || s.done) return { state: s, correct: false, correctAnswer: "", comboXpGained: 0 };

  if (ex.type === "match_pairs") {
    const rest = s.queue.slice(1);
    // a clean grid continues the run; any wrong pairing breaks it
    const clean = matchMistakes === 0;
    const combo = clean ? advanceCombo(s) : { combo: 0, maxCombo: s.maxCombo, comboBonusXp: s.comboBonusXp, gained: 0 };
    return {
      state: {
        ...s,
        queue: rest,
        solved: s.solved + 1,
        mistakes: s.mistakes + matchMistakes,
        missedExerciseIds: matchMistakes > 0 ? withMiss(s, ex.id) : s.missedExerciseIds,
        combo: combo.combo,
        maxCombo: combo.maxCombo,
        comboBonusXp: combo.comboBonusXp,
        done: rest.length === 0,
      },
      correct: clean,
      correctAnswer: "",
      comboXpGained: combo.gained,
    };
  }

  const result = grade(ex, answer);
  if (result.correct) {
    const rest = s.queue.slice(1);
    const combo = advanceCombo(s);
    return {
      state: {
        ...s,
        queue: rest,
        solved: s.solved + 1,
        combo: combo.combo,
        maxCombo: combo.maxCombo,
        comboBonusXp: combo.comboBonusXp,
        done: rest.length === 0,
      },
      correct: true,
      correctAnswer: result.correctAnswer,
      comboXpGained: combo.gained,
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
      combo: 0,
    },
    correct: false,
    correctAnswer: result.correctAnswer,
    comboXpGained: 0,
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

/**
 * XP this session should claim: lesson XP (+ perfect bonus) plus whatever the
 * combo earned. Practice replays are flat — see PRACTICE_XP — so combo can't
 * turn a finished lesson into an XP faucet.
 */
export function sessionXp(s: SessionState, practice: boolean): number {
  return practice ? PRACTICE_XP : lessonXp(s.lesson, isPerfect(s)) + s.comboBonusXp;
}
