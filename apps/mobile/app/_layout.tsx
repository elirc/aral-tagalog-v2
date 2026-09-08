import { Stack } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { refreshBundleIfNewer } from "@/lib/content";
import { ProgressProvider } from "@/lib/progress";
import { ThemeProvider, useTheme } from "@/theme";

/** Status-bar icons must invert with the theme: light icons on dark bg. */
function ThemedStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === "dark" ? "light" : "dark"} />;
}

export default function RootLayout() {
  // Check for newer content without downloading the entire audio catalog.
  // Recordings are cached when played; bundled lessons stay available offline.
  useEffect(() => {
    void refreshBundleIfNewer();
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
