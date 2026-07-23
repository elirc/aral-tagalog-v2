"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gradePair, type MatchPairsExercise } from "@aral/core";
import { playAudio } from "@/lib/audio";

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

/**
 * Match pairs is self-driving: it reports completion (with mistake count)
 * instead of a checkable answer.
 */
export function MatchView({
  exercise,
  onComplete,
}: {
  exercise: MatchPairsExercise;
  onComplete: (mistakes: number) => void;
}) {
  const lefts = useMemo(() => shuffled(exercise.pairs.map((p) => p.left), 11), [exercise]);
  const rights = useMemo(() => shuffled(exercise.pairs.map((p) => p.right), 29), [exercise]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const mistakes = useRef(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const tryMatch = (right: string) => {
    if (!selectedLeft) return;
    if (gradePair(exercise, selectedLeft, right)) {
      // vocab refs are the lowercased lemma with spaces/hyphens as underscores
      // ("Bagong Taon" -> bagong_taon); TTS speaks the word if no clip exists
      void playAudio(selectedLeft.toLowerCase().replace(/[\s-]+/g, "_"), selectedLeft);
      const next = new Set(matched).add(selectedLeft).add(`r:${right}`);
      setMatched(next);
      setSelectedLeft(null);
      setAnnounce(`${selectedLeft} matched`);
      if (next.size === exercise.pairs.length * 2) onComplete(mistakes.current);
    } else {
      mistakes.current += 1;
      setWrongFlash(right);
      setAnnounce("Not a match, try again");
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setWrongFlash(null), 400);
      setSelectedLeft(null);
    }
  };

  return (
    <div>
      <p className="exercise-prompt">Match the pairs</p>
      <p className="exercise-hint">Pick a Tagalog word on the left, then its match on the right.</p>
      {exercise.hint && <p className="exercise-hint">{exercise.hint}</p>}
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
      <div className="pairs-grid">
        <div className="choice-list">
          {lefts.map((left) => (
            <button
              key={left}
              className={`pair-btn ${matched.has(left) ? "matched" : ""} ${selectedLeft === left ? "selected" : ""}`}
              aria-pressed={selectedLeft === left}
              disabled={matched.has(left)}
              onClick={() => setSelectedLeft(left === selectedLeft ? null : left)}
            >
              {left}
            </button>
          ))}
        </div>
        <div className="choice-list">
          {rights.map((right) => (
            <button
              key={right}
              className={`pair-btn ${matched.has(`r:${right}`) ? "matched" : ""} ${wrongFlash === right ? "wrong" : ""}`}
              disabled={!selectedLeft || matched.has(`r:${right}`)}
              onClick={() => tryMatch(right)}
            >
              {right}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
