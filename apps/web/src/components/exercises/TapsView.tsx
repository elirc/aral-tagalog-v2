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
  const [audioFailed, setAudioFailed] = useState(false);

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
          <button
            className="audio-btn"
            onClick={() => void playAudio(exercise.audio).then((ok) => setAudioFailed(!ok))}
          >
            🔊 Play
          </button>
          {audioFailed && (
            // a listen exercise without audio is unanswerable (and would cost
            // hearts on every forced guess) — fall back to showing the sentence
            <p className="exercise-hint" role="status">
              🔇 Audio unavailable — tap the words for: <strong>{exercise.answer}</strong>
            </p>
          )}
        </>
      ) : (
        <>
          <p className="exercise-hint" style={{ marginBottom: 4 }}>
            {exercise.direction === "target_to_base" ? "Translate to English" : "Translate to Tagalog"}
          </p>
          <p className="exercise-prompt">
            {exercise.audio && (
              <button className="audio-btn" style={{ marginRight: 10, marginBottom: 0 }} onClick={() => playAudio(exercise.audio)} aria-label="play audio">
                🔊
              </button>
            )}
            {exercise.prompt}
          </p>
        </>
      )}
      {exercise.hint && <p className="exercise-hint">{exercise.hint}</p>}

      <div className="answer-strip">
        {picked.map((wordIdx, pos) => (
          <button
            key={`${wordIdx}-${pos}`}
            className="word-chip"
            disabled={disabled}
            aria-label={`remove ${exercise.wordBank[wordIdx]}`}
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
            aria-pressed={picked.includes(i)}
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
