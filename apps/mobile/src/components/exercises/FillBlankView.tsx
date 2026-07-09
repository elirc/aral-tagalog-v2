import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { FillBlankExercise } from "@aral/core";
import { playAudio } from "@/lib/audio";
import { colors, radii, spacing, styles } from "@/theme";
import { AudioButton } from "../AudioButton";

export function FillBlankView({
  exercise,
  onAnswerChange,
  disabled,
}: {
  exercise: FillBlankExercise;
  onAnswerChange: (answer: string | null) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");
  const [before, after] = exercise.sentence.split("___");

  const update = (v: string) => {
    setValue(v);
    onAnswerChange(v.trim() ? v : null);
  };

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
        {exercise.audio && <AudioButton onPress={() => void playAudio(exercise.audio)} />}
        <Text style={[styles.prompt, { marginBottom: 0 }]}>
          {before}
          <Text style={{ color: colors.accent, textDecorationLine: "underline" }}>
            {value || " ____ "}
          </Text>
          {after}
        </Text>
      </View>
      {exercise.translation && <Text style={[styles.muted, { marginTop: spacing.sm }]}>“{exercise.translation}”</Text>}
      {exercise.hint && <Text style={[styles.muted, { marginTop: spacing.xs }]}>{exercise.hint}</Text>}

      {exercise.options ? (
        <View style={[styles.chipRow, { marginTop: spacing.md }]}>
          {exercise.options.map((opt) => (
            <Pressable
              key={opt}
              style={[styles.optionBtn, value === opt && styles.optionSelected]}
              disabled={disabled}
              onPress={() => update(opt)}
            >
              <Text style={styles.optionText}>{opt}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <TextInput
          style={{
            borderWidth: 2,
            borderColor: colors.border,
            borderRadius: radii.md,
            padding: spacing.sm + 2,
            marginTop: spacing.md,
            fontSize: 17,
          }}
          value={value}
          editable={!disabled}
          placeholder="Type the missing word"
          autoCapitalize="none"
          onChangeText={update}
        />
      )}
    </View>
  );
}
