"use client";

import Link from "next/link";
import { displayStreak, levelForXp, localDayKey, MAX_HEARTS, regenerate } from "@aral/core";
import { deviceTz, useProgress } from "@/lib/progress";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  const { progress, user, logout, ready, pendingCount, needsRelogin, syncStatus, syncNow, storageError, rejectedCount } = useProgress();
  if (!ready) return <header className="header"><div className="header-inner"><span className="logo">Aral</span></div></header>;

  const now = Date.now();
  const hearts = regenerate(progress.hearts, now).hearts;
  const streak = displayStreak(progress.streak, localDayKey(now, deviceTz()));
  const level = levelForXp(progress.xpTotal);

  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="logo">Aral</Link>
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
          <Link href="/login" className="btn btn-ghost" style={{ color: "var(--danger)" }}>
            Session expired — log in
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
            <button className="btn btn-ghost" onClick={logout}>Log out</button>
          </>
        ) : (
          <Link href="/login" className="btn btn-ghost">Log in</Link>
        )}
      </div>
      {storageError && (
        <p className="save-notice" role="alert">
          Browser storage is unavailable. Keep this tab open until your progress syncs to your account.
          {!user && <> <Link href="/login">Log in to save your progress.</Link></>}
        </p>
      )}
      {user && needsRelogin ? (
        <p className="save-notice" role="status">
          Your session expired. Log in to sync your saved progress.
        </p>
      ) : user && syncStatus === "error" ? (
        <p className="save-notice" role="status">
          {storageError ? "Progress has not synced." : "Progress is saved on this device. Sync will retry automatically."}
          {" "}<button className="btn btn-ghost" onClick={() => void syncNow()}>Retry sync</button>
        </p>
      ) : null}
      {rejectedCount > 0 && (
        <p className="save-notice" role="alert">
          {rejectedCount} saved change{rejectedCount === 1 ? "" : "s"} could not be accepted. Your progress now reflects the server record.
        </p>
      )}
    </header>
  );
}
