"use client";

import { useState } from "react";
import type { FillBlankExercise } from "@aral/core";
import { playAudio } from "@/lib/audio";

export function FillBlankView({
  exercise,
  onAnswerChange,
  disabled,
}: {
  exercise: FillBlankExercise;
  onAnswerChange: (answer: string | null) => void;
  disabled: boolean;
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
        <span style={{ borderBottom: "3px solid var(--accent)", minWidth: 60, display: "inline-block", textAlign: "center" }}>
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
          onChange={(e) => update(e.target.value)}
        />
      )}
    </div>
  );
}
