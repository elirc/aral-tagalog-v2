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

export default function RootLayout() {
  // OFF-04: check for newer content in the background; never blocks play.
  // Then pull audio clips to device storage so lessons are playable offline
  // (OFF-01) — cacheAllAudio skips files it already has.
  useEffect(() => {
    void refreshBundleIfNewer().then(() => cacheAllAudio()).catch(() => {});
  }, []);

  return (
    <ThemeProvider>
      <ProgressProvider>
        <ThemedStatusBar />
        <Stack screenOptions={{ headerShown: false }} />
      </ProgressProvider>
    </ThemeProvider>
  );
}
