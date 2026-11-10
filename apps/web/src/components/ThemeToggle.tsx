"use client";

import { useEffect, useState } from "react";

/**
 * Point the browser/status-bar tint (<meta name="theme-color">, emitted per
 * OS scheme by layout's `viewport`) at the active theme's header color, so a
 * saved choice that differs from the OS preference doesn't leave a mismatched
 * bar. Reads --bg so the color stays owned by tokens.css.
 */
export function syncThemeColor() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  if (!bg) return;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", bg));
}

/**
 * Light/dark switch. The saved choice ("aral.theme") wins; without one the
 * OS preference applies (set before paint by the inline script in layout).
 */
export function ThemeToggle() {
  // render a stable placeholder until mounted — the real theme is only
  // knowable on the client, and SSR must not guess (hydration mismatch)
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
    syncThemeColor();

    // no saved choice → keep following the OS live (e.g. auto dark at sunset),
    // not just the scheme it had when the page loaded
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSchemeChange = (e: MediaQueryListEvent) => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem("aral.theme");
      } catch {
        // storage blocked — treat as no saved choice
      }
      if (saved === "dark" || saved === "light") return;
      document.documentElement.dataset.theme = e.matches ? "dark" : "light";
      setDark(e.matches);
      syncThemeColor();
    };
    mq.addEventListener("change", onSchemeChange);
    return () => mq.removeEventListener("change", onSchemeChange);
  }, []);

  const toggle = () => {
    const next = !dark;
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem("aral.theme", next ? "dark" : "light");
    } catch {
      // private mode etc. — theme still applies for this page load
    }
    setDark(next);
    syncThemeColor();
  };

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark === null ? "◐" : dark ? "☀️" : "🌙"}
    </button>
  );
}
