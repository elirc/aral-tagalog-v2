"use client";

import Link from "next/link";
import { useState } from "react";
import { displayStreak, levelForXp, localDayKey, MAX_HEARTS, regenerate } from "@aral/core";
import { deviceTz, useProgress } from "@/lib/progress";
import { ConfirmSheet } from "./ConfirmSheet";
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

/** Header XP must fit a 320px bar: exact below 10k, then "12.3k". */
function headerXp(xp: number): string {
  if (xp < 10_000) return xp.toLocaleString("en-US");
  return `${(Math.floor(xp / 100) / 10).toLocaleString("en-US")}k`;
}

// pages that render <Header /> give their <main> id="main"
const skipLink = (
  <a href="#main" className="skip-link">
    Skip to content
  </a>
);

export function Header() {
  const { progress, user, logout, ready, pendingCount, needsRelogin, syncNow } = useProgress();
  const [flushing, setFlushing] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  // Logging out deletes the local outbox, so unsynced progress is gone for
  // good. Try to save it first; only if that fails, ask before discarding.
  const onLogout = async () => {
    if (flushing) return;
    if (pendingCount === 0) return logout();
    if (typeof navigator === "undefined" || navigator.onLine !== false) {
      setFlushing(true);
      const flushed = await syncNow(); // bounded by the request timeout
      setFlushing(false);
      if (flushed) return logout();
    }
    setConfirmLogout(true);
  };

  if (!ready) {
    return (
      <header className="header">
        {skipLink}
        <div className="header-inner">
          <span className="logo">Aral</span>
        </div>
      </header>
    );
  }

  const now = Date.now();
  const hearts = regenerate(progress.hearts, now).hearts;
  const streak = displayStreak(progress.streak, localDayKey(now, deviceTz()));
  const level = levelForXp(progress.xpTotal);

  return (
    <>
    <header className="header">
      {skipLink}
      <div className="header-inner">
        <Link href="/" className="logo">Aral</Link>
        {/* phones: the bottom nav's Phrasebook tab replaces this (CSS hides it) */}
        <Link href="/words" className="nav-link" title="Phrasebook" aria-label="Phrasebook">
          📖
        </Link>
        <div className="stats">
          <Link href="/stats" className="level-chip" title="view your stats">Lv {level}</Link>
          <Link href="/stats" className="stats-link" title="view your stats">
            <span title="day streak">
              <span aria-hidden>🔥 {streak}</span>
              <span className="sr-only">{streak} day streak,</span>
            </span>
            <span title="total XP" style={{ color: "var(--warning-text)" }}>
              <span aria-hidden>⚡ {headerXp(progress.xpTotal)}</span>
              <span className="sr-only">{progress.xpTotal.toLocaleString("en-US")} total XP</span>
            </span>
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
            <span className="only-sm">
              <span className="hide-xs">⚠️ </span>Log in
            </span>
          </Link>
        ) : user ? (
          <>
            {pendingCount > 0 && (
              <span
                className="stat-sub header-pending"
                title={`${pendingCount} change${pendingCount > 1 ? "s" : ""} waiting to sync`}
              >
                ⟳ {pendingCount}
              </span>
            )}
            <button
              className="btn btn-ghost header-logout"
              onClick={() => void onLogout()}
              disabled={flushing}
              aria-busy={flushing}
              title={flushing ? "Saving your progress…" : "Log out"}
              aria-label={flushing ? "Saving your progress before logging out" : "Log out"}
            >
              <span className="only-sm"><LogoutIcon /></span>
              <span className="hide-sm">{flushing ? "Saving…" : "Log out"}</span>
            </button>
          </>
        ) : (
          <Link href="/login" className="btn btn-ghost">Log in</Link>
        )}
      </div>
    </header>
    {/* a sibling of <header>, not a child: `.header .btn` sizing must not reach the sheet */}
      <ConfirmSheet
        open={confirmLogout}
        title={pendingCount > 0 ? "Log out without saving?" : "Log out?"}
        cancelLabel="Stay logged in"
        confirmLabel={pendingCount > 0 ? "Log out anyway" : "Log out"}
        onCancel={() => setConfirmLogout(false)}
        onConfirm={() => {
          setConfirmLogout(false);
          logout();
        }}
      >
        {pendingCount > 0 ? (
          <p>
            <strong>
              {pendingCount} change{pendingCount > 1 ? "s" : ""}
            </strong>{" "}
            on this device {pendingCount > 1 ? "haven't" : "hasn't"} reached your account — the server
            couldn&apos;t be reached. Logging out now deletes {pendingCount > 1 ? "them" : "it"} for good. Stay
            logged in and {pendingCount > 1 ? "they" : "it"} will sync when you&apos;re back online.
          </p>
        ) : (
          // a background sync landed while this sheet was open
          <p>Everything is saved to your account now.</p>
        )}
      </ConfirmSheet>
    </>
  );
}
