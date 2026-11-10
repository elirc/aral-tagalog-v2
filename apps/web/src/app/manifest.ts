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
      // full-bleed PNGs (app/pwa-icon/[size]) so Android launchers can apply
      // their own mask instead of shrinking the rounded SVG into a white disc
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
      // installers and Lighthouse also want plain 192/512 PNG entries; the
      // glyph keeps safe margins, so the same files serve both purposes
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
