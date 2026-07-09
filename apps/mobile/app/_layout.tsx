import { Stack } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { refreshBundleIfNewer } from "@/lib/content";
import { ProgressProvider } from "@/lib/progress";

export default function RootLayout() {
  // OFF-04: check for newer content in the background; never blocks play
  useEffect(() => {
    void refreshBundleIfNewer();
  }, []);

  return (
    <ProgressProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </ProgressProvider>
  );
}
