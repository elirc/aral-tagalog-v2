import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { ArrangeExercise } from "@aral/core";
import { spacing, useTheme } from "@/theme";

/**
 * Word-order drill. Same tap-to-build interaction as TapsView, but the tokens
 * are exactly the answer's words with no distractors — the exercise *is* the
 * ordering, so the prompt shows the English meaning.
 */
export function ArrangeView({
  exercise,
  onAnswerChange,
  disabled,
}: {
  exercise: ArrangeExercise;
  onAnswerChange: (answer: string[] | null) => void;
  disabled: boolean;
}) {
  const { colors, styles } = useTheme();
  const [picked, setPicked] = useState<number[]>([]);

  const update = (next: number[]) => {
    setPicked(next);
    onAnswerChange(next.length > 0 ? next.map((i) => exercise.tokens[i]!) : null);
  };

  return (
    <View>
      <Text style={[styles.muted, { marginBottom: spacing.xs }]}>Put the words in order</Text>
      <Text style={styles.prompt}>{exercise.prompt}</Text>
      {exercise.hint && <Text style={[styles.muted, { marginTop: spacing.sm }]}>{exercise.hint}</Text>}

      <View
        style={[
          styles.chipRow,
          {
            minHeight: 56,
            borderBottomWidth: 2,
            borderBottomColor: colors.border,
            paddingBottom: spacing.sm,
            marginVertical: spacing.md,
          },
        ]}
      >
        {picked.map((tokenIdx, pos) => (
          <Pressable
            key={`${tokenIdx}-${pos}`}
            style={styles.optionBtn}
            disabled={disabled}
            onPress={() => update(picked.filter((_, p) => p !== pos))}
          >
            <Text style={styles.optionText}>{exercise.tokens[tokenIdx]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.chipRow}>
        {exercise.tokens.map((token, i) => {
          const used = picked.includes(i);
          return (
            <Pressable
              key={i}
              style={[styles.optionBtn, used && { opacity: 0.3 }]}
              disabled={disabled || used}
              onPress={() => update([...picked, i])}
            >
              <Text style={styles.optionText}>{token}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
