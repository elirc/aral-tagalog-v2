"use client";

import { useState } from "react";
import type { FillBlankExercise } from "@aral/core";
import { playAudio } from "@/lib/audio";

export function FillBlankView({
  exercise,
  onAnswerChange,
  disabled,
  onSubmit,
}: {
  exercise: FillBlankExercise;
  onAnswerChange: (answer: string | null) => void;
  disabled: boolean;
  /** invoked on Enter in the free-text input, so typing flows straight to Check */
  onSubmit?: () => void;
}) {
  const [value, setValue] = useState<string>("");
  const [before, after] = exercise.sentence.split("___");

  const update = (v: string) => {
    setValue(v);
    onAnswerChange(v.trim() ? v : null);
  };

  return (
    <div>
      <p className="exercise-prompt">
        {exercise.audio && (
          <button className="audio-btn" style={{ marginRight: 10, marginBottom: 0 }} onClick={() => playAudio(exercise.audio)} aria-label="play audio">
            🔊
          </button>
        )}
        {before}
        <span
          aria-hidden
          style={{ borderBottom: "3px solid var(--accent)", minWidth: 60, display: "inline-block", textAlign: "center" }}
        >
          {value || "    "}
        </span>
        {after}
      </p>
      {exercise.translation && <p className="exercise-hint">“{exercise.translation}”</p>}
      {exercise.hint && <p className="exercise-hint">{exercise.hint}</p>}

      {exercise.options ? (
        <div className="word-bank">
          {exercise.options.map((opt) => (
            <button
              key={opt}
              className={`word-chip ${value === opt ? "selected choice-btn" : ""}`}
              aria-pressed={value === opt}
              disabled={disabled}
              onClick={() => update(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <input
          className="blank-input"
          value={value}
          disabled={disabled}
          placeholder="Type the missing word"
          aria-label="the missing word"
          onChange={(e) => update(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim() && !disabled) onSubmit?.();
          }}
        />
      )}
    </div>
  );
}
