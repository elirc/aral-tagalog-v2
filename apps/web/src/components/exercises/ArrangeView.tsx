"use client";

import { useState } from "react";
import type { ArrangeExercise } from "@aral/core";

/**
 * Word-order drill. Same tap-to-build interaction as TapsView, but the tokens
 * are exactly the answer's words with no distractors — the whole exercise is
 * the ordering, so the prompt is the English meaning rather than a sentence
 * to translate.
 */
export function ArrangeView({
  exercise,
  onAnswerChange,
  disabled,
}: {
  exercise: ArrangeExercise;
  onAnswerChange: (answer: string[] | null) => void;
  disabled: boolean;
}) {
  // picked = indices into tokens, in tap order (indices allow duplicate words)
  const [picked, setPicked] = useState<number[]>([]);

  const update = (next: number[]) => {
    setPicked(next);
    onAnswerChange(next.length > 0 ? next.map((i) => exercise.tokens[i]!) : null);
  };

  return (
    <div>
      <p className="exercise-hint" style={{ marginBottom: 4 }}>
        Put the words in order
      </p>
      <p className="exercise-prompt">{exercise.prompt}</p>
      {exercise.hint && <p className="exercise-hint">{exercise.hint}</p>}

      <div className="answer-strip">
        {picked.map((tokenIdx, pos) => (
          <button
            key={`${tokenIdx}-${pos}`}
            className="word-chip"
            disabled={disabled}
            aria-label={`remove ${exercise.tokens[tokenIdx]}`}
            onClick={() => update(picked.filter((_, p) => p !== pos))}
          >
            {exercise.tokens[tokenIdx]}
          </button>
        ))}
      </div>

      <div className="word-bank">
        {exercise.tokens.map((token, i) => (
          <button
            key={i}
            className={`word-chip ${picked.includes(i) ? "used" : ""}`}
            aria-pressed={picked.includes(i)}
            disabled={disabled || picked.includes(i)}
            onClick={() => update([...picked, i])}
          >
            {token}
          </button>
        ))}
      </div>
    </div>
  );
}
