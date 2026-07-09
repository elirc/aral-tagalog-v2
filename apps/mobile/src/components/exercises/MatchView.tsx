import { useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { gradePair, type MatchPairsExercise } from "@aral/core";
import { colors, spacing, styles } from "@/theme";

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
  const mistakes = useRef(0);

  const tryMatch = (right: string) => {
    if (!selectedLeft) return;
    if (gradePair(exercise, selectedLeft, right)) {
      const next = new Set(matched).add(selectedLeft).add(`r:${right}`);
      setMatched(next);
      setSelectedLeft(null);
      if (next.size === exercise.pairs.length * 2) onComplete(mistakes.current);
    } else {
      mistakes.current += 1;
      setWrongFlash(right);
      setTimeout(() => setWrongFlash(null), 400);
      setSelectedLeft(null);
    }
  };

  return (
    <View>
      <Text style={styles.prompt}>Match the pairs</Text>
      {exercise.hint && <Text style={[styles.muted, { marginBottom: spacing.sm }]}>{exercise.hint}</Text>}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <View style={{ flex: 1, gap: spacing.sm }}>
          {lefts.map((left) => (
            <Pressable
              key={left}
              style={[
                styles.optionBtn,
                matched.has(left) && { opacity: 0.35 },
                selectedLeft === left && styles.optionSelected,
              ]}
              disabled={matched.has(left)}
              onPress={() => setSelectedLeft(left === selectedLeft ? null : left)}
            >
              <Text style={styles.optionText}>{left}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flex: 1, gap: spacing.sm }}>
          {rights.map((right) => (
            <Pressable
              key={right}
              style={[
                styles.optionBtn,
                matched.has(`r:${right}`) && { opacity: 0.35 },
                wrongFlash === right && { borderColor: colors.danger, backgroundColor: colors.wrongBg },
              ]}
              disabled={matched.has(`r:${right}`) || !selectedLeft}
              onPress={() => tryMatch(right)}
            >
              <Text style={styles.optionText}>{right}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
