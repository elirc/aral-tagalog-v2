import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, Text, View } from "react-native";
import { presentationOrder, type ListenExercise, type TranslateTapsExercise } from "@aral/core";
import { playAudio } from "@/lib/audio";
import { radii, spacing, useTheme } from "@/theme";
import { AudioButton } from "../AudioButton";

/** pressed: the 4pt bottom edge sinks to 2pt; margin + translate keep the
 *  layout box fixed so neighbours don't jump */
const pressDown = { borderBottomWidth: 2, marginBottom: 2, transform: [{ translateY: 2 }] } as const;

export function TapsView({
  exercise,
  salt,
  onAnswerChange,
  disabled,
}: {
  exercise: TranslateTapsExercise | ListenExercise;
  /** `SessionState.attempts`: reshuffles the layout each time the exercise comes round */
  salt: number;
  onAnswerChange: (answer: string[] | null) => void;
  disabled: boolean;
}) {
  const { colors, styles } = useTheme();
  // picked = indices into wordBank, in tap order (indices allow duplicate words)
  const [picked, setPicked] = useState<number[]>([]);
  // bank tiles in display order — seeded by (exercise, attempt): stable across
  // re-renders, fresh on a retry
  const bankOrder = useMemo(() => presentationOrder(exercise, salt).wordBankOrder, [exercise, salt]);
  const [audioFailed, setAudioFailed] = useState(false);
  // the failed state reveals the answer, so only the newest tap may set it —
  // a stale failure must not override a retry that played fine
  const playGen = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const playListen = () => {
    const gen = ++playGen.current;
    void playAudio(exercise.audio).then(
      (ok) => {
        if (!mounted.current || gen !== playGen.current) return;
        setAudioFailed(!ok);
        if (!ok) {
          AccessibilityInfo.announceForAccessibility(`Audio unavailable. Tap the words for: ${exercise.answer}`);
        }
      },
      () => {},
    );
  };

  const update = (next: number[]) => {
    setPicked(next);
    onAnswerChange(next.length > 0 ? next.map((i) => exercise.wordBank[i]!) : null);
  };

  const isListen = exercise.type === "listen";

  return (
    <View>
      {isListen ? (
        <>
          <Text accessibilityRole="header" style={styles.prompt}>
            Tap what you hear
          </Text>
          <AudioButton large onPress={playListen} />
          {audioFailed && (
            // a listen exercise without audio is unanswerable (and would cost a
            // heart on every forced guess) — fall back to showing the sentence
            <View
              style={{
                marginTop: spacing.sm,
                padding: spacing.sm,
                borderRadius: radii.md,
                backgroundColor: colors.bgMuted,
              }}
            >
              <Text style={styles.muted}>
                🔇 Audio unavailable — tap the words for:{" "}
                <Text style={{ fontWeight: "800", color: colors.text }}>{exercise.answer}</Text>
              </Text>
            </View>
          )}
        </>
      ) : (
        <>
          <Text style={[styles.muted, { marginBottom: spacing.xs }]}>
            {exercise.direction === "target_to_base" ? "Translate to English" : "Translate to Tagalog"}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            {exercise.audio && <AudioButton onPress={() => void playAudio(exercise.audio)} />}
            <Text accessibilityRole="header" style={[styles.prompt, { flex: 1, marginBottom: 0 }]}>
              {exercise.prompt}
            </Text>
          </View>
        </>
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
            accessibilityRole="button"
            accessibilityLabel={`${exercise.wordBank[wordIdx]}, in answer`}
            accessibilityHint="removes the word"
            accessibilityState={{ disabled }}
            style={({ pressed }) => [styles.optionBtn, styles.chip, pressed && pressDown]}
            disabled={disabled}
            onPress={() => update(picked.filter((_, p) => p !== pos))}
          >
            <Text style={styles.optionText}>{exercise.wordBank[wordIdx]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.chipRow}>
        {bankOrder.map((i) => {
          const word = exercise.wordBank[i]!;
          const used = picked.includes(i);
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={used ? `${word}, used` : word}
              accessibilityState={{ disabled: disabled || used }}
              style={({ pressed }) => [styles.optionBtn, styles.chip, used && { opacity: 0.3 }, pressed && pressDown]}
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
