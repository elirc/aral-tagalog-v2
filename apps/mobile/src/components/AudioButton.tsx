import { Pressable, Text } from "react-native";
import { radii, useTheme } from "@/theme";

export function AudioButton({ onPress, large }: { onPress: () => void; large?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="play audio"
      style={{
        backgroundColor: colors.accent,
        borderRadius: radii.md,
        paddingVertical: large ? 14 : 8,
        paddingHorizontal: large ? 22 : 12,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ fontSize: large ? 24 : 18 }}>🔊{large ? " Play" : ""}</Text>
    </Pressable>
  );
}
