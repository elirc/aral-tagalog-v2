"use client";

import { localDayKey, questStatuses, todayStats, type UserProgress } from "@aral/core";
import { deviceTz } from "@/lib/progress";

/**
 * Today's three daily quests with live progress (GAM). Nothing here is
 * clickable — quests are derived by the reducer and their XP is credited the
 * moment a lesson completion pushes a counter over the target, so there is no
 * "claim" step to get out of sync with the server.
 */
export function QuestPanel({ progress }: { progress: UserProgress }) {
  const tz = deviceTz();
  const now = Date.now();
  const quests = questStatuses(localDayKey(now, tz), todayStats(progress, tz, now));
  const done = quests.filter((q) => q.complete).length;

  return (
    <section className="quest-panel">
      <header className="quest-head">
        <h2 className="quest-title">Daily quests</h2>
        <span className="quest-count">
          {done}/{quests.length} done
        </span>
      </header>
      <ul className="quest-list">
        {quests.map((q) => (
          <li className={`quest-row ${q.complete ? "done" : ""}`} key={q.def.id}>
            <span className="quest-emoji" aria-hidden>
              {q.complete ? "✅" : q.def.emoji}
            </span>
            <span className="quest-body">
              <span className="quest-name">{q.def.description}</span>
              <span
                className="progress-track thin"
                role="progressbar"
                aria-label={q.def.description}
                aria-valuemin={0}
                aria-valuemax={q.def.target}
                aria-valuenow={Math.min(q.value, q.def.target)}
              >
                <span className="progress-fill" style={{ width: `${q.fraction * 100}%`, display: "block" }} />
              </span>
            </span>
            <span className="quest-reward">
              <span className="quest-progress-text">
                {Math.min(q.value, q.def.target)}/{q.def.target}
              </span>
              <span className="quest-xp">+{q.def.rewardXp} XP</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="quest-foot">Quests reset at midnight, {tz.replace("_", " ")}.</p>
    </section>
  );
}
