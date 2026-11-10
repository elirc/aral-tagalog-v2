import type { Metadata, Viewport } from "next";
import { colors, darkColors } from "@aral/ui";
import { ProgressProvider } from "@/lib/progress";
import { BottomNav } from "@/components/BottomNav";
import "@aral/ui/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  // routes set their own titles via their layouts' metadata
  title: { default: "Aral — Learn Tagalog", template: "%s — Aral" },
  description: "A free Duolingo-style course teaching Tagalog to English speakers.",
  applicationName: "Aral",
  // launched from the iOS home screen → standalone, no Safari chrome.
  // "default" keeps dark status-bar text on our light header; black-translucent
  // would draw white text over it.
  appleWebApp: { capable: true, title: "Aral", statusBarStyle: "default" },
  // iOS would otherwise turn XP/streak numbers into tel: links
  formatDetection: { telephone: false },
  // Next 15 emits only mobile-web-app-capable; older iOS reads the apple- one
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // draw under the notch/home indicator; globals.css pads with safe-area insets
  viewportFit: "cover",
  // matches the header surface (--bg). ThemeToggle re-syncs these when the
  // user's saved choice differs from the OS preference.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: colors.bg },
    { media: "(prefers-color-scheme: dark)", color: darkColors.bg },
  ],
};

// Runs before first paint so a saved dark preference never flashes light.
// No saved choice → follow the OS preference.
const themeInit = `(function(){try{var t=localStorage.getItem("aral.theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.dataset.theme="dark";}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <ProgressProvider>{children}</ProgressProvider>
        <BottomNav />
      </body>
    </html>
  );
}
