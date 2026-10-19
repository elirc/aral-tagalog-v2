import type { MetadataRoute } from "next";
import { colors } from "@aral/ui";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Aral — Learn Tagalog",
    short_name: "Aral",
    description: "A free Duolingo-style course teaching Tagalog to English speakers.",
    lang: "en",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // splash = page background; bar = header surface, so the status bar
    // blends into the sticky header
    background_color: colors.bgMuted,
    theme_color: colors.bg,
    categories: ["education"],
    icons: [
      // app/icon.svg and app/apple-icon.tsx are served at these paths
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
