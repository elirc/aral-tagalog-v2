"use client";

import { useEffect, useMemo, useState } from "react";
import { presentationOrder, type ChoiceExercise } from "@aral/core";
import { playAudio } from "@/lib/audio";

export function ChoiceView({
  exercise,
  salt,
  onAnswerChange,
  disabled,
}: {
  exercise: ChoiceExercise;
  /** SessionState.attempts: same attempt → same layout, a retry → reshuffled */
  salt: number;
  onAnswerChange: (answer: string | null) => void;
  disabled: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const options = useMemo(() => presentationOrder(exercise, salt).options, [exercise, salt]);

  // number keys pick an option (1 = first choice), mirroring the visible chips
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target instanceof HTMLElement ? e.target : null;
      // typing, or a confirm sheet is open over the exercise
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.closest("dialog"))) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return; // Ctrl/Cmd+1 switches browser tabs

      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > options.length) return;
      const opt = options[n - 1]!;
      setSelected(opt);
      onAnswerChange(opt);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [disabled, options, onAnswerChange]);

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
        {options.map((opt, i) => (
          <button
            key={opt}
            className={`choice-btn ${selected === opt ? "selected" : ""}`}
            aria-pressed={selected === opt}
            disabled={disabled}
            onClick={() => {
              setSelected(opt);
              onAnswerChange(opt);
            }}
          >
            <span className="kbd" aria-hidden>
              {i + 1}
            </span>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
