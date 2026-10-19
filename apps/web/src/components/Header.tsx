"use client";

import Link from "next/link";
import { displayStreak, levelForXp, localDayKey, MAX_HEARTS, regenerate } from "@aral/core";
import { deviceTz, useProgress } from "@/lib/progress";
import { ThemeToggle } from "./ThemeToggle";

function LogoutIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

export function Header() {
  const { progress, user, logout, ready, pendingCount, needsRelogin } = useProgress();
  if (!ready) return <header className="header"><div className="header-inner"><span className="logo">Aral</span></div></header>;

  const now = Date.now();
  const hearts = regenerate(progress.hearts, now).hearts;
  const streak = displayStreak(progress.streak, localDayKey(now, deviceTz()));
  const level = levelForXp(progress.xpTotal);

  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="logo">Aral</Link>
        {/* phones: the bottom nav's Phrasebook tab replaces this (CSS hides it) */}
        <Link href="/words" className="nav-link" title="Phrasebook" aria-label="Phrasebook">
          📖
        </Link>
        <div className="stats">
          <Link href="/stats" className="level-chip" title="view your stats">Lv {level}</Link>
          <Link href="/stats" className="stats-link" title="view your stats">
            <span title="day streak">🔥 {streak}</span>
            <span title="total XP" style={{ color: "var(--warning-text)" }}>⚡ {progress.xpTotal}</span>
          </Link>
          <span className="hearts" title="hearts">
            ❤️ {hearts}/{MAX_HEARTS}
          </span>
        </div>
        <ThemeToggle />
        {user && needsRelogin ? (
          <Link
            href="/login"
            className="btn btn-ghost header-relogin"
            title="Session expired — log in"
            aria-label="Session expired — log in"
          >
            <span className="hide-sm">Session expired — log in</span>
            <span className="only-sm">⚠️ Log in</span>
          </Link>
        ) : user ? (
          <>
            {pendingCount > 0 && (
              <span
                className="stat-sub"
                title={`${pendingCount} change${pendingCount > 1 ? "s" : ""} waiting to sync`}
              >
                ⟳ {pendingCount}
              </span>
            )}
            <button className="btn btn-ghost header-logout" onClick={logout} title="Log out" aria-label="Log out">
              <span className="only-sm"><LogoutIcon /></span>
              <span className="hide-sm">Log out</span>
            </button>
          </>
        ) : (
          <Link href="/login" className="btn btn-ghost">Log in</Link>
        )}
      </div>
    </header>
  );
}
