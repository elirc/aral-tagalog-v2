import { Fragment, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { DialogueExercise } from "@aral/core";
import { playAudio } from "@/lib/audio";
import { radii, spacing, useTheme } from "@/theme";
import { AudioButton } from "../AudioButton";

/**
 * A conversation with several blanks. The answer is a string[] parallel to
 * `exercise.blanks`; core's grade() requires every blank to be right.
 *
 * One blank is active at a time — tapping a blank selects it and the option
 * row below fills it, which keeps the whole exchange readable on a phone
 * instead of stacking a control under every line.
 */
export function DialogueView({
  exercise,
  onAnswerChange,
  disabled,
}: {
  exercise: DialogueExercise;
  onAnswerChange: (answer: string[] | null) => void;
  disabled: boolean;
}) {
  const { colors, styles } = useTheme();
  const [filled, setFilled] = useState<string[]>(() => exercise.blanks.map(() => ""));
  const [active, setActive] = useState(0);

  // `advance` only on option taps: jumping while someone types in the free-text
  // input would move the caret out from under them mid-word
  const update = (index: number, value: string, advance: boolean) => {
    const next = filled.map((v, i) => (i === index ? value : v));
    setFilled(next);
    // only offer the answer once every blank has something in it — a partly
    // filled dialogue would just burn a heart
    onAnswerChange(next.every((v) => v.trim() !== "") ? next : null);
    if (!advance) return;
    const nextEmpty = next.findIndex((v, i) => i > index && v.trim() === "");
    setActive(nextEmpty === -1 ? index : nextEmpty);
  };

  // walk the lines, replacing each "___" with the next blank in order
  let blankIndex = 0;
  const renderLine = (text: string) => {
    const parts = text.split("___");
    return parts.map((part, i) => {
      if (i === parts.length - 1) return <Text key={`t${i}`}>{part}</Text>;
      const idx = blankIndex++;
      const value = filled[idx] ?? "";
      const isActive = active === idx;
      return (
        <Fragment key={`p${i}`}>
          <Text>{part}</Text>
          <Text
            onPress={disabled ? undefined : () => setActive(idx)}
            style={{
              color: value ? colors.text : colors.textMuted,
              backgroundColor: isActive ? colors.accentSoft : colors.bgMuted,
              textDecorationLine: "underline",
              fontWeight: "700",
            }}
          >
            {value || "  ____  "}
          </Text>
        </Fragment>
      );
    });
  };

  const activeBlank = exercise.blanks[active];

  return (
    <View>
      {exercise.intro && <Text style={[styles.muted, { marginBottom: spacing.xs }]}>{exercise.intro}</Text>}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Text style={styles.muted}>Fill in every blank</Text>
        {exercise.audio && <AudioButton onPress={() => void playAudio(exercise.audio)} />}
      </View>

      <View style={{ gap: spacing.md, marginVertical: spacing.md }}>
        {exercise.lines.map((line, i) => (
          <View key={i} style={{ borderLeftWidth: 3, borderLeftColor: colors.border, paddingLeft: spacing.sm }}>
            {line.speaker && (
              <Text style={[styles.muted, { fontSize: 12, fontWeight: "800", textTransform: "uppercase" }]}>
                {line.speaker}
              </Text>
            )}
            <Text style={[styles.body, { fontWeight: "600", lineHeight: 28 }]}>{renderLine(line.text)}</Text>
            {line.translation && <Text style={[styles.muted, { marginTop: 2 }]}>{line.translation}</Text>}
          </View>
        ))}
      </View>

      {exercise.hint && <Text style={[styles.muted, { marginBottom: spacing.sm }]}>{exercise.hint}</Text>}

      {activeBlank?.options ? (
        <View style={styles.chipRow}>
          {activeBlank.options.map((opt) => (
            <Pressable
              key={opt}
              style={[styles.optionBtn, filled[active] === opt && styles.optionSelected]}
              disabled={disabled}
              onPress={() => update(active, opt, true)}
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
            fontSize: 17,
            color: colors.text,
          }}
          value={filled[active] ?? ""}
          editable={!disabled}
          placeholder={`Blank ${active + 1}`}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          onChangeText={(v) => update(active, v, false)}
        />
      )}
    </View>
  );
}
