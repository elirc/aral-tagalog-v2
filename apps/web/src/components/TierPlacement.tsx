"use client";

import { useState } from "react";
import { tierStatuses, type CourseTier, type UserProgress } from "@aral/core";
import { bundle } from "@/lib/content";
import { newEventId, useProgress } from "@/lib/progress";

/**
 * Placement: jump straight into a difficulty tier instead of working up to it.
 * Writes a `tier_started` progress event, which is all the unlock logic needs
 * (core's isLessonUnlocked reads progress.unlockedTierIds) — no separate
 * state, no server call.
 */
export function TierPlacement({ progress }: { progress: UserProgress }) {
  const { addEvents } = useProgress();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<CourseTier | null>(null);

  const tiers = bundle.tiers ?? [];
  if (tiers.length < 2) return null;

  const statuses = tierStatuses(bundle.units, progress.completedLessonIds, {
    tiers,
    unlockedTierIds: progress.unlockedTierIds,
  });
  const locked = statuses.filter((s) => !s.unlocked);
  if (locked.length === 0) return null; // everything already open

  const place = (tier: CourseTier) => {
    addEvents([{ id: newEventId(), type: "tier_started", occurredAt: Date.now(), tierId: tier.id }]);
    setConfirming(null);
    setOpen(false);
  };

  return (
    <section className="placement">
      <button className="placement-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span aria-hidden>🎓</span> Not a beginner? Jump to your level
      </button>

      {open && (
        <div className="placement-body">
          <p className="placement-lead">
            Pick the track that sounds like you. Earlier tiers stay open — nothing is skipped or lost, you
            just start somewhere else.
          </p>
          {statuses.map((s) => (
            <div className={`placement-row ${s.unlocked ? "open" : ""}`} key={s.tier.id}>
              <span className="placement-dot" style={{ background: s.tier.color ?? "var(--accent)" }} aria-hidden />
              <span className="placement-text">
                <strong>{s.tier.title}</strong>
                {s.tier.entryHint && <span className="placement-hint">{s.tier.entryHint}</span>}
              </span>
              {s.unlocked ? (
                <span className="placement-open-tag">
                  {s.reason === "placed" ? "you started here" : "open"}
                </span>
              ) : (
                <button className="btn btn-ghost" onClick={() => setConfirming(s.tier)}>
                  Start here
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {confirming && (
        <div className="placement-confirm" role="alertdialog" aria-label={`Start at ${confirming.title}?`}>
          <p>
            Start at <strong>{confirming.title}</strong>? Lessons before it stay unlocked and unfinished —
            your XP, streak and hearts are untouched.
          </p>
          <div className="placement-actions">
            <button className="btn btn-primary" onClick={() => place(confirming)}>
              Yes, start here
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirming(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
