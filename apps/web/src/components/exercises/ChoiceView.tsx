"use client";

import { useMemo, useState } from "react";
import type { ChoiceExercise } from "@aral/core";
import { playAudio } from "@/lib/audio";

/** stable shuffle so options don't jump around between renders */
function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function ChoiceView({
  exercise,
  onAnswerChange,
  disabled,
}: {
  exercise: ChoiceExercise;
  onAnswerChange: (answer: string | null) => void;
  disabled: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const options = useMemo(
    () => shuffled([exercise.answer, ...exercise.distractors], exercise.id.length * 7 + exercise.prompt.length),
    [exercise],
  );

  return (
    <div>
      <p className="exercise-prompt">
        {exercise.audio && (
          <button className="audio-btn" style={{ marginRight: 10, marginBottom: 0 }} onClick={() => playAudio(exercise.audio)} aria-label="play audio">
            🔊
          </button>
        )}
        {exercise.prompt}
      </p>
      {exercise.hint && <p className="exercise-hint">{exercise.hint}</p>}
      <div className="choice-list">
        {options.map((opt) => (
          <button
            key={opt}
            className={`choice-btn ${selected === opt ? "selected" : ""}`}
            disabled={disabled}
            onClick={() => {
              setSelected(opt);
              onAnswerChange(opt);
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
