import type { Metadata } from "next";
import { ProgressProvider } from "@/lib/progress";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aral — Learn Tagalog",
  description: "A free Duolingo-style course teaching Tagalog to English speakers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ProgressProvider>{children}</ProgressProvider>
      </body>
    </html>
  );
}
