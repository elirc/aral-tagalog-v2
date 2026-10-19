import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, Text, View } from "react-native";
import { gradePair, type MatchPairsExercise } from "@aral/core";
import { spacing, useTheme } from "@/theme";

/** pressed: the 4pt bottom edge sinks to 2pt; margin + translate keep the
 *  layout box fixed so neighbours don't jump */
const pressDown = { borderBottomWidth: 2, marginBottom: 2, transform: [{ translateY: 2 }] } as const;

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
  const { colors, styles } = useTheme();
  const lefts = useMemo(() => shuffled(exercise.pairs.map((p) => p.left), 11), [exercise]);
  const rights = useMemo(() => shuffled(exercise.pairs.map((p) => p.right), 29), [exercise]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);
  const mistakes = useRef(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  const tryMatch = (right: string) => {
    if (!selectedLeft) return;
    if (gradePair(exercise, selectedLeft, right)) {
      const next = new Set(matched).add(selectedLeft).add(`r:${right}`);
      setMatched(next);
      setSelectedLeft(null);
      if (next.size === exercise.pairs.length * 2) {
        AccessibilityInfo.announceForAccessibility("All pairs matched");
        onComplete(mistakes.current);
      } else {
        AccessibilityInfo.announceForAccessibility(`Matched: ${selectedLeft}, ${right}`);
      }
    } else {
      mistakes.current += 1;
      AccessibilityInfo.announceForAccessibility(`Not a match: ${selectedLeft}, ${right}`);
      setWrongFlash(right);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setWrongFlash(null), 400);
      setSelectedLeft(null);
    }
  };

  return (
    <View>
      <Text accessibilityRole="header" style={styles.prompt}>
        Match the pairs
      </Text>
      {exercise.hint && <Text style={[styles.muted, { marginBottom: spacing.sm }]}>{exercise.hint}</Text>}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <View style={{ flex: 1, gap: spacing.sm }}>
          {lefts.map((left) => {
            const done = matched.has(left);
            return (
              <Pressable
                key={left}
                accessibilityRole="button"
                accessibilityLabel={done ? `${left}, matched` : left}
                accessibilityState={{ selected: selectedLeft === left, disabled: done }}
                style={({ pressed }) => [
                  styles.optionBtn,
                  done && { opacity: 0.35 },
                  selectedLeft === left && styles.optionSelected,
                  pressed && pressDown,
                ]}
                disabled={done}
                onPress={() => setSelectedLeft(left === selectedLeft ? null : left)}
              >
                <Text style={styles.optionText}>{left}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flex: 1, gap: spacing.sm }}>
          {rights.map((right) => {
            const done = matched.has(`r:${right}`);
            return (
              <Pressable
                key={right}
                accessibilityRole="button"
                accessibilityLabel={done ? `${right}, matched` : right}
                accessibilityHint={!done && !selectedLeft ? "pick a word on the left first" : undefined}
                accessibilityState={{ disabled: done || !selectedLeft }}
                style={({ pressed }) => [
                  styles.optionBtn,
                  done && { opacity: 0.35 },
                  wrongFlash === right && { borderColor: colors.danger, backgroundColor: colors.wrongBg },
                  pressed && pressDown,
                ]}
                disabled={done || !selectedLeft}
                onPress={() => tryMatch(right)}
              >
                <Text style={styles.optionText}>{right}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
