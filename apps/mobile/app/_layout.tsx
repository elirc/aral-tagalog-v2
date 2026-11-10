import { Stack } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { cacheAllAudio } from "@/lib/audio";
import { refreshBundleIfNewer } from "@/lib/content";
import { ProgressProvider } from "@/lib/progress";
import { ThemeProvider, useTheme } from "@/theme";

/** Status-bar icons must invert with the theme: light icons on dark bg. */
function ThemedStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === "dark" ? "light" : "dark"} />;
}

/**
 * Native stack with the theme's screen color as the card background, so a
 * push/pop or swipe-back never flashes the default white behind a dark
 * screen. expo-router already mounts SafeAreaProvider above this layout;
 * each screen applies its own insets. Android hardware back pops the stack
 * as usual (headerShown is off, so screens draw their own back buttons),
 * except mid-lesson, where LessonPlayer intercepts it to confirm quitting.
 */
function ThemedStack() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bgMuted },
      }}
    />
  );
}

export default function RootLayout() {
  // OFF-04: check for newer content in the background; never blocks play.
  // Then pull audio clips to device storage so lessons are playable offline
  // (OFF-01) — cacheAllAudio skips files it already has.
  useEffect(() => {
    // best-effort: a filesystem hiccup must not surface as an unhandled rejection
    void refreshBundleIfNewer()
      .then(() => cacheAllAudio())
      .catch(() => {});
  }, []);

  return (
    <ThemeProvider>
      <ProgressProvider>
        <ThemedStatusBar />
        <ThemedStack />
      </ProgressProvider>
    </ThemeProvider>
  );
}
