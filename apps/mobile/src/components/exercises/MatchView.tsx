import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, Text, View } from "react-native";
import { gradePair, presentationOrder, type MatchPairsExercise } from "@aral/core";
import { playAudio } from "@/lib/audio";
import { spacing, useTheme } from "@/theme";

/** pressed: the 4pt bottom edge sinks to 2pt; margin + translate keep the
 *  layout box fixed so neighbours don't jump */
const pressDown = { borderBottomWidth: 2, marginBottom: 2, transform: [{ translateY: 2 }] } as const;

export function MatchView({
  exercise,
  salt,
  onComplete,
}: {
  exercise: MatchPairsExercise;
  /** `SessionState.attempts`: reshuffles the layout each time the exercise comes round */
  salt: number;
  onComplete: (mistakes: number) => void;
}) {
  const { colors, styles } = useTheme();
  // seeded by (exercise, attempt): stable across re-renders, fresh next time
  const { lefts, rights } = useMemo(() => presentationOrder(exercise, salt), [exercise, salt]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  // both tiles of a wrong pairing flash: the left selection clears at once, so
  // flashing only the right one hid which left word was tried
  const [wrongFlash, setWrongFlash] = useState<{ left: string; right: string } | null>(null);
  const mistakes = useRef(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  const wrongStyle = { borderColor: colors.danger, backgroundColor: colors.wrongBg };

  const tryMatch = (right: string) => {
    if (!selectedLeft) return;
    if (gradePair(exercise, selectedLeft, right)) {
      // vocab refs are the lowercased lemma with spaces/hyphens as underscores
      // ("Bagong Taon" -> bagong_taon); TTS speaks the word if no clip exists
      void playAudio(selectedLeft.toLowerCase().replace(/[\s-]+/g, "_"), selectedLeft);
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
      setWrongFlash({ left: selectedLeft, right });
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setWrongFlash(null), 500);
      setSelectedLeft(null);
    }
  };

  return (
    <View>
      <Text accessibilityRole="header" style={[styles.prompt, { marginBottom: spacing.xs }]}>
        Match the pairs
      </Text>
      <Text style={[styles.muted, { marginBottom: spacing.sm }]}>
        Pick a Tagalog word on the left, then its match on the right.
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
                  wrongFlash?.left === left && selectedLeft !== left && wrongStyle,
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
                  wrongFlash?.right === right && wrongStyle,
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
