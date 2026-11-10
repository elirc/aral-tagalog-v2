import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { presentationOrder, type ChoiceExercise } from "@aral/core";
import { playAudio } from "@/lib/audio";
import { spacing, useTheme } from "@/theme";
import { AudioButton } from "../AudioButton";

/** pressed: the 4pt bottom edge sinks to 2pt; margin + translate keep the
 *  layout box fixed so neighbours don't jump */
const pressDown = { borderBottomWidth: 2, marginBottom: 2, transform: [{ translateY: 2 }] } as const;

export function ChoiceView({
  exercise,
  salt,
  onAnswerChange,
  disabled,
}: {
  exercise: ChoiceExercise;
  /** `SessionState.attempts`: reshuffles the layout each time the exercise comes round */
  salt: number;
  onAnswerChange: (answer: string | null) => void;
  disabled: boolean;
}) {
  const { styles } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  // seeded by (exercise, attempt): stable across re-renders, fresh on a retry
  const options = useMemo(() => presentationOrder(exercise, salt).options, [exercise, salt]);

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
        {exercise.audio && <AudioButton onPress={() => void playAudio(exercise.audio)} />}
        <Text accessibilityRole="header" style={[styles.prompt, { flex: 1, marginBottom: 0 }]}>
          {exercise.prompt}
        </Text>
      </View>
      {exercise.hint && <Text style={[styles.muted, { marginBottom: spacing.sm }]}>{exercise.hint}</Text>}
      <View style={{ gap: spacing.sm }}>
        {options.map((opt) => (
          <Pressable
            key={opt}
            accessibilityRole="button"
            accessibilityState={{ selected: selected === opt, disabled }}
            style={({ pressed }) => [
              styles.optionBtn, // ≥50pt tall: 12pt padding ×2 + 17pt text + borders
              selected === opt && styles.optionSelected,
              pressed && pressDown,
            ]}
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
