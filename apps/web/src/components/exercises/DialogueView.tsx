"use client";

import { useState, type ReactNode } from "react";
import type { DialogueExercise } from "@aral/core";
import { playAudio } from "@/lib/audio";

/**
 * A conversation with several blanks. The answer is a string[] parallel to
 * `exercise.blanks` — LessonPlayer passes it straight to core's grade(), which
 * requires every blank to be right.
 *
 * Blanks are filled one at a time: tapping a blank makes it active, and the
 * option row below fills whichever blank is active. That keeps the whole
 * exchange readable instead of stacking a control under every line.
 */
export function DialogueView({
  exercise,
  onAnswerChange,
  disabled,
}: {
  exercise: DialogueExercise;
  onAnswerChange: (answer: string[] | null) => void;
  disabled: boolean;
}) {
  const [filled, setFilled] = useState<string[]>(() => exercise.blanks.map(() => ""));
  const [active, setActive] = useState(0);

  // `advance` only on option taps: auto-jumping while someone types in the
  // free-text input would move the caret out from under them mid-word
  const update = (index: number, value: string, advance: boolean) => {
    const next = filled.map((v, i) => (i === index ? value : v));
    setFilled(next);
    // only offer the answer once every blank has something in it — a partly
    // filled dialogue would just burn a heart
    onAnswerChange(next.every((v) => v.trim() !== "") ? next : null);
    // jump to the next empty blank so tapping through the options flows
    if (!advance) return;
    const nextEmpty = next.findIndex((v, i) => i > index && v.trim() === "");
    setActive(nextEmpty === -1 ? index : nextEmpty);
  };

  // walk the lines, replacing each "___" with the next blank button in order
  let blankIndex = 0;
  const renderLine = (text: string): ReactNode[] => {
    const parts = text.split("___");
    const out: ReactNode[] = [];
    parts.forEach((part, i) => {
      out.push(<span key={`t${i}`}>{part}</span>);
      if (i < parts.length - 1) {
        const idx = blankIndex++;
        const value = filled[idx] ?? "";
        out.push(
          <button
            key={`b${idx}`}
            type="button"
            className={`dialogue-blank ${active === idx ? "active" : ""} ${value ? "filled" : ""}`}
            disabled={disabled}
            aria-label={`blank ${idx + 1}${value ? `, filled with ${value}` : ", empty"}`}
            onClick={() => setActive(idx)}
          >
            {/* non-breaking spaces keep an empty blank wide enough to tap */}
            {value || "\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0"}
          </button>,
        );
      }
    });
    return out;
  };

  const activeBlank = exercise.blanks[active];

  return (
    <div>
      {exercise.intro && (
        <p className="exercise-hint" style={{ marginBottom: 4 }}>
          {exercise.intro}
        </p>
      )}
      <p className="exercise-hint" style={{ marginBottom: 12 }}>
        Fill in every blank
        {exercise.audio && (
          <button
            className="audio-btn"
            style={{ marginLeft: 10, marginBottom: 0, padding: "4px 10px" }}
            onClick={() => playAudio(exercise.audio)}
            aria-label="play the conversation"
          >
            🔊
          </button>
        )}
      </p>

      <div className="dialogue">
        {exercise.lines.map((line, i) => (
          <div className="dialogue-line" key={i}>
            {line.speaker && <span className="dialogue-speaker">{line.speaker}</span>}
            <p className="dialogue-text">{renderLine(line.text)}</p>
            {line.translation && <p className="dialogue-translation">{line.translation}</p>}
          </div>
        ))}
      </div>

      {exercise.hint && <p className="exercise-hint">{exercise.hint}</p>}

      {activeBlank?.options ? (
        <div className="word-bank" role="group" aria-label={`options for blank ${active + 1}`}>
          {activeBlank.options.map((opt) => (
            <button
              key={opt}
              className={`word-chip ${filled[active] === opt ? "selected choice-btn" : ""}`}
              aria-pressed={filled[active] === opt}
              disabled={disabled}
              onClick={() => update(active, opt, true)}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <input
          className="blank-input"
          value={filled[active] ?? ""}
          disabled={disabled}
          placeholder={`Blank ${active + 1}`}
          aria-label={`answer for blank ${active + 1}`}
          onChange={(e) => update(active, e.target.value, false)}
        />
      )}
    </div>
  );
}
