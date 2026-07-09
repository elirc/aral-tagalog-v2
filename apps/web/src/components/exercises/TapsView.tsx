"use client";

import { useState } from "react";
import type { ListenExercise, TranslateTapsExercise } from "@aral/core";
import { playAudio } from "@/lib/audio";

/** Tap-the-words builder, used by both translate_taps and listen exercises. */
export function TapsView({
  exercise,
  onAnswerChange,
  disabled,
}: {
  exercise: TranslateTapsExercise | ListenExercise;
  onAnswerChange: (answer: string[] | null) => void;
  disabled: boolean;
}) {
  // picked = indices into wordBank, in tap order (indices allow duplicate words)
  const [picked, setPicked] = useState<number[]>([]);

  const update = (next: number[]) => {
    setPicked(next);
    onAnswerChange(next.length > 0 ? next.map((i) => exercise.wordBank[i]!) : null);
  };

  const isListen = exercise.type === "listen";

  return (
    <div>
      {isListen ? (
        <>
          <p className="exercise-prompt">Tap what you hear</p>
          <button className="audio-btn" onClick={() => playAudio(exercise.audio)}>
            🔊 Play
          </button>
        </>
      ) : (
        <p className="exercise-prompt">
          {exercise.audio && (
            <button className="audio-btn" style={{ marginRight: 10, marginBottom: 0 }} onClick={() => playAudio(exercise.audio)} aria-label="play audio">
              🔊
            </button>
          )}
          {exercise.prompt}
        </p>
      )}
      {exercise.hint && <p className="exercise-hint">{exercise.hint}</p>}

      <div className="answer-strip">
        {picked.map((wordIdx, pos) => (
          <button
            key={`${wordIdx}-${pos}`}
            className="word-chip"
            disabled={disabled}
            onClick={() => update(picked.filter((_, p) => p !== pos))}
          >
            {exercise.wordBank[wordIdx]}
          </button>
        ))}
      </div>

      <div className="word-bank">
        {exercise.wordBank.map((word, i) => (
          <button
            key={i}
            className={`word-chip ${picked.includes(i) ? "used" : ""}`}
            disabled={disabled || picked.includes(i)}
            onClick={() => update([...picked, i])}
          >
            {word}
          </button>
        ))}
      </div>
    </div>
  );
}
