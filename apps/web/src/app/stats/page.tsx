"use client";

import Link from "next/link";
import {
  ACHIEVEMENTS,
  DEFAULT_DAILY_GOAL_XP,
  displayStreak,
  earnedAchievementIds,
  levelProgress,
  localDayKey,
  type AchievementDef,
} from "@aral/core";
import { Header } from "@/components/Header";
import { QuestPanel } from "@/components/QuestPanel";
import { bundle } from "@/lib/content";
import { deviceTz, newEventId, useProgress } from "@/lib/progress";

/* ---------- calendar/date helpers (pure "YYYY-MM-DD" math, DST-safe) ---------- */

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];

/** The day key `n` calendar days before `todayKey` (n=0 → same day). */
function dayKeyMinus(todayKey: string, n: number): string {
  const [y, m, d] = todayKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!) - n * 86_400_000);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

/** 0 = Sunday … 6 = Saturday for a day key. */
function weekday(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

/** "Mon Jul 14" style label for tooltips. */
function prettyDay(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const GOAL_PRESETS = [
  { xp: 10, label: "Casual" },
  { xp: 20, label: "Regular" },
  { xp: 30, label: "Serious" },
  { xp: 50, label: "Intense" },
];

export default function StatsPage() {
  const { progress, ready, user } = useProgress();

  if (!ready) {
    return (
      <>
        <Header />
        <main className="container" />
      </>
    );
  }

  const now = Date.now();
  const tz = deviceTz();
  const todayKey = localDayKey(now, tz);

  const lp = levelProgress(progress.xpTotal);
  const levelPct = lp.xpForNextLevel > 0 ? (lp.xpIntoLevel / lp.xpForNextLevel) * 100 : 0;
  const currentStreak = displayStreak(progress.streak, todayKey);
  const todayXp = progress.xpByDay[todayKey] ?? 0;
  const goal = progress.dailyGoalXp || DEFAULT_DAILY_GOAL_XP;
  const goalMet = todayXp >= goal;

  const earned = new Set(earnedAchievementIds(progress, bundle.units));
  const brandNew = progress.xpTotal === 0 && Object.keys(progress.xpByDay).length === 0;

  return (
    <>
      <Header />
      <main className="container">
        <h1 className="page-title">Your stats</h1>
        {!user ? (
          <p className="page-sub">
            Playing as guest — <Link href="/register">create a free account</Link> to keep these
            stats across devices.
          </p>
        ) : (
          <p className="page-sub">Track your XP, streak and achievements.</p>
        )}

        {brandNew && (
          <div className="card" style={{ textAlign: "center" }}>
            <p className="big-emoji" style={{ fontSize: 40, margin: 0 }}>
              🌱
            </p>
            <p style={{ margin: "8px 0 0", fontWeight: 700 }}>No progress yet</p>
            <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 14 }}>
              Finish your first lesson to start earning XP and unlocking achievements.
            </p>
            <Link href="/" className="btn btn-primary" style={{ marginTop: 14 }}>
              Start learning
            </Link>
          </div>
        )}

        {/* --- stat tiles --- */}
        <section className="tile-grid">
          <div className="stat-tile">
            <div className="stat-top">⚡ Total XP</div>
            <p className="stat-value" style={{ color: "var(--warning-text)" }}>
              {progress.xpTotal}
            </p>
          </div>
          <div className="stat-tile">
            <div className="stat-top">🎖️ Level</div>
            <p className="stat-value">{lp.level}</p>
            <div className="progress-track thin" style={{ marginTop: 8 }}>
              <div className="progress-fill" style={{ width: `${levelPct}%` }} />
            </div>
            <p className="stat-sub">
              {lp.xpIntoLevel}/{lp.xpForNextLevel} XP to Lv {lp.level + 1}
            </p>
          </div>
          <div className="stat-tile">
            <div className="stat-top">🔥 Streak</div>
            <p className="stat-value">{currentStreak}</p>
            <p className="stat-sub">Longest: {progress.longestStreak} day{progress.longestStreak === 1 ? "" : "s"}</p>
          </div>
          <div className="stat-tile">
            <div className="stat-top">📘 Lessons</div>
            <p className="stat-value">{progress.lessonsCompleted}</p>
            <p className="stat-sub">completed</p>
          </div>
          <div className="stat-tile">
            <div className="stat-top">✨ Perfect</div>
            <p className="stat-value">{progress.perfectLessons}</p>
            <p className="stat-sub">flawless lessons</p>
          </div>
          <div className="stat-tile">
            <div className="stat-top">🎯 Today</div>
            <p className="stat-value" style={{ color: goalMet ? "var(--primary)" : undefined }}>
              {todayXp}
            </p>
            <p className="stat-sub">of {goal} XP goal</p>
          </div>
        </section>

        {/* --- daily goal ring + editor --- */}
        <h2 className="section-title">Daily goal</h2>
        <div className="card">
          <div className="goal-row">
            <GoalRing todayXp={todayXp} goal={goal} />
            <GoalEditor goal={goal} />
          </div>
        </div>

        {/* --- daily quests (the panel brings its own heading) --- */}
        <QuestPanel progress={progress} />

        {/* --- last-14-days XP --- */}
        <h2 className="section-title">Last 14 days</h2>
        <div className="card">
          <XpBars todayKey={todayKey} xpByDay={progress.xpByDay} goal={goal} />
        </div>

        {/* --- streak calendar --- */}
        <h2 className="section-title">Activity</h2>
        <div className="card">
          <StreakCalendar todayKey={todayKey} xpByDay={progress.xpByDay} goal={goal} />
        </div>

        {/* --- achievements --- */}
        <h2 className="section-title">
          Achievements <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: 15 }}>({earned.size}/{ACHIEVEMENTS.length})</span>
        </h2>
        <Achievements earned={earned} />
      </main>
    </>
  );
}

/* ---------------------------------- goal ring --------------------------------- */

function GoalRing({ todayXp, goal }: { todayXp: number; goal: number }) {
  const size = 156;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = goal > 0 ? Math.min(1, todayXp / goal) : 0;
  const met = todayXp >= goal;
  const cx = size / 2;

  return (
    <svg
      className="goal-ring"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${todayXp} of ${goal} XP today`}
    >
      <circle cx={cx} cy={cx} r={r} fill="none" style={{ stroke: "var(--border)" }} strokeWidth={stroke} />
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        style={{ stroke: "var(--primary)", transition: "stroke-dasharray .4s" }}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c * frac} ${c}`}
        transform={`rotate(-90 ${cx} ${cx})`}
      />
      <text x={cx} y={cx - 6} textAnchor="middle" style={{ fontSize: 30, fontWeight: 800, fill: "var(--text)" }}>
        {todayXp}
      </text>
      <text x={cx} y={cx + 18} textAnchor="middle" style={{ fontSize: 13, fontWeight: 700, fill: "var(--text-muted)" }}>
        {met ? "goal met 🎯" : `/ ${goal} XP`}
      </text>
    </svg>
  );
}

function GoalEditor({ goal }: { goal: number }) {
  const { addEvents } = useProgress();
  const setGoal = (goalXp: number) => {
    addEvents([{ id: newEventId(), type: "goal_set", occurredAt: Date.now(), goalXp }]);
  };
  return (
    <div className="goal-editor">
      <p style={{ margin: 0, fontWeight: 700 }}>Set your daily XP goal</p>
      <p style={{ margin: "2px 0 0", color: "var(--text-muted)", fontSize: 13 }}>
        Pick a target that keeps your streak going.
      </p>
      <div className="goal-presets">
        {GOAL_PRESETS.map((p) => (
          <button
            key={p.xp}
            className={`goal-preset${goal === p.xp ? " active" : ""}`}
            onClick={() => setGoal(p.xp)}
            aria-pressed={goal === p.xp}
          >
            {p.xp} XP
            <small>{p.label}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- xp bar chart ------------------------------- */

function XpBars({
  todayKey,
  xpByDay,
  goal,
}: {
  todayKey: string;
  xpByDay: Record<string, number>;
  goal: number;
}) {
  const days = Array.from({ length: 14 }, (_, i) => {
    const key = dayKeyMinus(todayKey, 13 - i);
    return { key, xp: xpByDay[key] ?? 0 };
  });

  const W = 340;
  const H = 150;
  const padL = 6;
  const padR = 6;
  const padT = 16;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const max = Math.max(goal, ...days.map((d) => d.xp), 1);
  const slot = plotW / days.length;
  const barW = Math.min(slot - 6, 20);
  const baseY = padT + plotH;
  const goalY = padT + plotH * (1 - goal / max);

  return (
    <>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="XP earned over the last 14 days">
        {/* baseline (recessive axis) */}
        <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} style={{ stroke: "var(--border)" }} strokeWidth={1} />

        {/* goal reference line */}
        {goal > 0 && goal <= max && (
          <>
            <line
              x1={padL}
              y1={goalY}
              x2={W - padR}
              y2={goalY}
              style={{ stroke: "var(--text-muted)" }}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            <text x={W - padR} y={goalY - 4} textAnchor="end" style={{ fontSize: 10, fontWeight: 700, fill: "var(--text-muted)" }}>
              goal {goal}
            </text>
          </>
        )}

        {days.map((d, i) => {
          const isToday = i === days.length - 1;
          const h = plotH * (d.xp / max);
          const x = padL + i * slot + (slot - barW) / 2;
          const y = baseY - h;
          return (
            <g key={d.key}>
              {d.xp > 0 && (
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx={3}
                  style={{ fill: isToday ? "var(--accent)" : "var(--primary)" }}
                >
                  <title>
                    {prettyDay(d.key)}: {d.xp} XP
                  </title>
                </rect>
              )}
              <text
                x={x + barW / 2}
                y={H - 6}
                textAnchor="middle"
                style={{
                  fontSize: 9,
                  fontWeight: isToday ? 800 : 600,
                  fill: isToday ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {WEEKDAY[weekday(d.key)]}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="chart-cap">
        Today: <strong style={{ color: "var(--accent)" }}>{days[days.length - 1]!.xp} XP</strong>
        {" · "}
        14-day total: {days.reduce((s, d) => s + d.xp, 0)} XP
      </p>
    </>
  );
}

/* -------------------------------- streak calendar ----------------------------- */

function StreakCalendar({
  todayKey,
  xpByDay,
  goal,
}: {
  todayKey: string;
  xpByDay: Record<string, number>;
  goal: number;
}) {
  const weeks = 5;
  const wd = weekday(todayKey); // column of today in the last row

  const level = (xp: number): 0 | 1 | 2 | 3 => {
    if (xp <= 0) return 0;
    if (xp >= goal) return 3;
    if (xp >= goal / 2) return 2;
    return 1;
  };

  const rows = Array.from({ length: weeks }, (_, r) =>
    Array.from({ length: 7 }, (_, c) => {
      const daysFromToday = (r - (weeks - 1)) * 7 + (c - wd);
      if (daysFromToday > 0) return { key: null as string | null, future: true, lvl: 0 };
      const key = dayKeyMinus(todayKey, -daysFromToday);
      return { key, future: false, lvl: level(xpByDay[key] ?? 0), today: daysFromToday === 0 };
    }),
  );

  return (
    <>
      <div className="cal">
        <div className="cal-row">
          {WEEKDAY.map((w, i) => (
            <div className="cal-head" key={i}>
              {w}
            </div>
          ))}
        </div>
        {rows.map((row, r) => (
          <div className="cal-row" key={r}>
            {row.map((cell, c) => (
              <div
                key={c}
                className={`cal-cell${cell.future ? " future" : ""}${cell.lvl ? ` lvl${cell.lvl}` : ""}${
                  "today" in cell && cell.today ? " today" : ""
                }`}
                title={cell.key ? `${prettyDay(cell.key)}: ${xpByDay[cell.key] ?? 0} XP` : undefined}
                // title alone is mouse-only; expose the same data to screen readers
                role={cell.key ? "img" : undefined}
                aria-label={cell.key ? `${prettyDay(cell.key)}: ${xpByDay[cell.key] ?? 0} XP` : undefined}
                aria-hidden={cell.key ? undefined : true}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="cal-legend">
        <span>less</span>
        <span className="swatch" />
        <span className="swatch lvl1" />
        <span className="swatch lvl2" />
        <span className="swatch lvl3" />
        <span>more</span>
      </div>
    </>
  );
}

/* ---------------------------------- achievements ------------------------------ */

function Achievements({ earned }: { earned: Set<string> }) {
  const tiers: { tier: 1 | 2 | 3; name: string }[] = [
    { tier: 1, name: "Early wins" },
    { tier: 2, name: "Momentum" },
    { tier: 3, name: "Long haul" },
  ];
  return (
    <>
      {tiers.map(({ tier, name }) => {
        const defs = ACHIEVEMENTS.filter((a) => a.tier === tier);
        const got = defs.filter((a) => earned.has(a.id)).length;
        return (
          <div key={tier}>
            <div className="tier-group-head">
              <span className={`tier-badge tier-${tier}`}>Tier {tier}</span>
              <span className="name">{name}</span>
              <span className="earned-of">
                {got}/{defs.length}
              </span>
            </div>
            <div className="ach-grid">
              {defs.map((a) => (
                <AchievementCard key={a.id} def={a} earned={earned.has(a.id)} />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function AchievementCard({ def, earned }: { def: AchievementDef; earned: boolean }) {
  return (
    <div className={`achievement ${earned ? "earned" : "locked"}`} title={def.description}>
      {!earned && <span className="ach-lock">🔒</span>}
      <div className="ach-emoji">{earned ? def.emoji : "❔"}</div>
      <p className="ach-title">{def.title}</p>
      <p className="ach-desc">{def.description}</p>
    </div>
  );
}
