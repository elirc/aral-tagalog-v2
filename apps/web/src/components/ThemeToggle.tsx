"use client";

import { useEffect, useState } from "react";

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
