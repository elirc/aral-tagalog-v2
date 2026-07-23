import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { ChoiceExercise } from "@aral/core";
import { playAudio } from "@/lib/audio";
import { spacing, useTheme } from "@/theme";
import { AudioButton } from "../AudioButton";

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
  const { styles } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const options = useMemo(
    () => shuffled([exercise.answer, ...exercise.distractors], exercise.id.length * 7 + exercise.prompt.length),
    [exercise],
  );

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
        {exercise.audio && <AudioButton onPress={() => void playAudio(exercise.audio)} />}
        <Text style={[styles.prompt, { flex: 1, marginBottom: 0 }]}>{exercise.prompt}</Text>
      </View>
      {exercise.hint && <Text style={[styles.muted, { marginBottom: spacing.sm }]}>{exercise.hint}</Text>}
      <View style={{ gap: spacing.sm }}>
        {options.map((opt) => (
          <Pressable
            key={opt}
            style={[styles.optionBtn, selected === opt && styles.optionSelected]}
            disabled={disabled}
            onPress={() => {
              setSelected(opt);
              onAnswerChange(opt);
            }}
          >
            <Text style={styles.optionText}>{opt}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
