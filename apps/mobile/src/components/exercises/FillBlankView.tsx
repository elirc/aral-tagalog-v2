import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { FillBlankExercise } from "@aral/core";
import { playAudio } from "@/lib/audio";
import { radii, spacing, useTheme } from "@/theme";
import { AudioButton } from "../AudioButton";

/** pressed: the 4pt bottom edge sinks to 2pt; margin + translate keep the
 *  layout box fixed so neighbours don't jump */
const pressDown = { borderBottomWidth: 2, marginBottom: 2, transform: [{ translateY: 2 }] } as const;

export function FillBlankView({
  exercise,
  onAnswerChange,
  disabled,
  onSubmit,
}: {
  exercise: FillBlankExercise;
  onAnswerChange: (answer: string | null) => void;
  disabled: boolean;
  /** invoked by the keyboard's return key, so typing flows straight to Check */
  onSubmit?: () => void;
}) {
  const { colors, styles } = useTheme();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [before, after] = exercise.sentence.split("___");

  const update = (v: string) => {
    setValue(v);
    onAnswerChange(v.trim() ? v : null);
  };

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
        {exercise.audio && <AudioButton onPress={() => void playAudio(exercise.audio)} />}
        <Text
          style={[styles.prompt, { marginBottom: 0, flexShrink: 1 }]}
          // screen readers would read the underscores; speak the gap instead
          accessibilityLabel={`${before ?? ""} ${value || "blank"} ${after ?? ""}`}
        >
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
              accessibilityRole="button"
              accessibilityState={{ selected: value === opt, disabled }}
              style={({ pressed }) => [styles.optionBtn, value === opt && styles.optionSelected, pressed && pressDown]}
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
            borderColor: focused ? colors.accent : colors.border,
            borderRadius: radii.md,
            paddingVertical: spacing.sm + 4,
            paddingHorizontal: spacing.md,
            marginTop: spacing.md,
            minHeight: 52,
            fontSize: 18,
            color: colors.text,
            backgroundColor: disabled ? colors.bgMuted : colors.bg,
          }}
          value={value}
          editable={!disabled}
          placeholder="Type the missing word"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="the missing word"
          selectionColor={colors.accent}
          // answers are Tagalog: the device dictionary "corrects" them into
          // English words and capitalizes the first letter
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
          returnKeyType="done"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChangeText={update}
          onSubmitEditing={() => {
            if (!disabled && value.trim()) onSubmit?.();
          }}
        />
      )}
    </View>
  );
}
