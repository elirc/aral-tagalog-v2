"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { syncThemeColor } from "./ThemeToggle";

// Phone-width tab bar (CSS shows it at ≤640px only). Hidden on full-screen
// flows: lessons pin their own Check button to the bottom, and auth pages
// have nowhere useful to go yet.
const HIDDEN_PREFIXES = ["/lesson", "/login", "/register"];

const svgProps = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const TABS = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg {...svgProps}>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9v11h5v-6h4v6h5V9" />
      </svg>
    ),
  },
  {
    href: "/words",
    label: "Phrasebook",
    icon: (
      <svg {...svgProps}>
        <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5z" />
        <path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H19v-3" />
        <path d="M9 8h6M9 11.5h4" />
      </svg>
    ),
  },
  {
    href: "/stats",
    label: "Stats",
    icon: (
      <svg {...svgProps}>
        <path d="M5 20V12M12 20V5M19 20v-9" />
      </svg>
    ),
  },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

export function BottomNav() {
  const pathname = usePathname() ?? "/";

  // routes without the Header (lessons) still get the right status-bar tint;
  // re-run per route since navigation may re-emit the per-scheme viewport metas
  useEffect(() => {
    syncThemeColor();
  }, [pathname]);

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <>
      {/* in-flow clearance so the fixed bar never covers the end of a page;
          rendered only alongside the bar, so lesson/auth routes get no dead space */}
      <div className="bottom-nav-spacer" aria-hidden="true" />
      <nav className="bottom-nav" aria-label="Main">
        {TABS.map((t) => {
          const active = isActive(pathname, t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={active ? "bottom-tab active" : "bottom-tab"}
              aria-current={active ? "page" : undefined}
              onClick={
                active
                  ? (e) => {
                      // modified clicks keep their open-in-new-tab/window meaning
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                      // native tab-bar convention: tapping the current tab returns to the top
                      e.preventDefault();
                      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
                    }
                  : undefined
              }
            >
              <span className="bottom-tab-icon">{t.icon}</span>
              <span className="bottom-tab-label">{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
