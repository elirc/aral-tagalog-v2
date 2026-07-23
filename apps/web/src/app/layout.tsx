import type { Metadata } from "next";
import { ProgressProvider } from "@/lib/progress";
import "@aral/ui/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aral — Learn Tagalog",
  description: "A free Duolingo-style course teaching Tagalog to English speakers.",
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
      </body>
    </html>
  );
}
