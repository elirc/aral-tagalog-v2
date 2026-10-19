import { useSyncExternalStore } from "react";
import { Pressable, Text } from "react-native";
import { isAudioPlaying, subscribeAudioPlaying } from "@/lib/audio";
import { radii, useTheme } from "@/theme";

export function AudioButton({ onPress, large }: { onPress: () => void; large?: boolean }) {
  const { colors } = useTheme();
  // one clip plays at a time (lib/audio), and each exercise shows at most one
  // button, so the global flag is this button's state
  const playing = useSyncExternalStore(subscribeAudioPlaying, isAudioPlaying);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={playing ? "playing audio, tap to replay" : "play audio"}
      accessibilityState={{ busy: playing }}
      hitSlop={8}
      style={({ pressed }) => ({
        backgroundColor: playing ? colors.accentSoft : colors.accent,
        borderWidth: 2,
        borderColor: colors.accent,
        borderRadius: radii.md,
        minWidth: 48,
        minHeight: 48,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: large ? 12 : 6,
        paddingHorizontal: large ? 22 : 10,
        alignSelf: "flex-start",
        opacity: pressed ? 0.7 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      {/* base label keeps RN's default dark text (≈8:1 on accent; white is ~2.4:1) */}
      <Text style={[{ fontSize: large ? 24 : 20, fontWeight: "700" }, playing && { color: colors.text }]}>
        {playing ? "🔉" : "🔊"}
        {large ? (playing ? " Playing…" : " Play") : ""}
      </Text>
    </Pressable>
  );
}
