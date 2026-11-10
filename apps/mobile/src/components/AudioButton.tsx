import { useSyncExternalStore } from "react";
import { Pressable, Text } from "react-native";
import { isAudioPlaying, subscribeAudioPlaying } from "@/lib/audio";
import { ICON_MAX_SCALE, ON_ACCENT, radii, useTheme } from "@/theme";

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
      {/* dark label on the accent fill; theme text once it switches to the soft tint */}
      <Text
        maxFontSizeMultiplier={large ? undefined : ICON_MAX_SCALE}
        style={{ fontSize: large ? 24 : 20, fontWeight: "700", color: playing ? colors.text : ON_ACCENT }}
      >
        {playing ? "🔉" : "🔊"}
        {large ? (playing ? " Playing…" : " Play") : ""}
      </Text>
    </Pressable>
  );
}
