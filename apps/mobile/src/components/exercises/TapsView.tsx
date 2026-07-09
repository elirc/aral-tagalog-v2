import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { ListenExercise, TranslateTapsExercise } from "@aral/core";
import { playAudio } from "@/lib/audio";
import { colors, spacing, styles } from "@/theme";
import { AudioButton } from "../AudioButton";

export function TapsView({
  exercise,
  onAnswerChange,
  disabled,
}: {
  exercise: TranslateTapsExercise | ListenExercise;
  onAnswerChange: (answer: string[] | null) => void;
  disabled: boolean;
}) {
  const [picked, setPicked] = useState<number[]>([]);

  const update = (next: number[]) => {
    setPicked(next);
    onAnswerChange(next.length > 0 ? next.map((i) => exercise.wordBank[i]!) : null);
  };

  const isListen = exercise.type === "listen";

  return (
    <View>
      {isListen ? (
        <>
          <Text style={styles.prompt}>Tap what you hear</Text>
          <AudioButton large onPress={() => void playAudio(exercise.audio)} />
        </>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          {exercise.audio && <AudioButton onPress={() => void playAudio(exercise.audio)} />}
          <Text style={[styles.prompt, { flex: 1, marginBottom: 0 }]}>{exercise.prompt}</Text>
        </View>
      )}
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
        {picked.map((wordIdx, pos) => (
          <Pressable
            key={`${wordIdx}-${pos}`}
            style={styles.optionBtn}
            disabled={disabled}
            onPress={() => update(picked.filter((_, p) => p !== pos))}
          >
            <Text style={styles.optionText}>{exercise.wordBank[wordIdx]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.chipRow}>
        {exercise.wordBank.map((word, i) => {
          const used = picked.includes(i);
          return (
            <Pressable
              key={i}
              style={[styles.optionBtn, used && { opacity: 0.3 }]}
              disabled={disabled || used}
              onPress={() => update([...picked, i])}
            >
              <Text style={styles.optionText}>{word}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
