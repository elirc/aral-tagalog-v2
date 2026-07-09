"use client";

import Link from "next/link";
import { displayStreak, localDayKey, MAX_HEARTS, regenerate } from "@aral/core";
import { deviceTz, useProgress } from "@/lib/progress";

export function Header() {
  const { progress, user, logout, ready } = useProgress();
  if (!ready) return <header className="header"><div className="header-inner"><span className="logo">Aral</span></div></header>;

  const now = Date.now();
  const hearts = regenerate(progress.hearts, now).hearts;
  const streak = displayStreak(progress.streak, localDayKey(now, deviceTz()));

  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="logo">Aral</Link>
        <div className="stats">
          <span title="day streak">🔥 {streak}</span>
          <span title="total XP" style={{ color: "var(--warning)" }}>⚡ {progress.xpTotal}</span>
          <span className="hearts" title="hearts">
            ❤️ {hearts}/{MAX_HEARTS}
          </span>
        </div>
        {user ? (
          <button className="btn btn-ghost" onClick={logout}>Log out</button>
        ) : (
          <Link href="/login" className="btn btn-ghost">Log in</Link>
        )}
      </div>
    </header>
  );
}
