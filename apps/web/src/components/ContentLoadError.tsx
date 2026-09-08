"use client";

import Link from "next/link";
import { useProgress } from "@/lib/progress";

/** Retry transient failures; reload can recover an old tab after a new deployment. */
export function ContentLoadError({ title, retryLabel, onRetry }: { title: string; retryLabel: string; onRetry: () => void }) {
  const { storageError, pendingCount } = useProgress();
  const unsafeToReload = storageError && pendingCount > 0;
  return <div className="center-card">
    <h2>{title}</h2>
    <p role="alert">Check your connection and retry. If the app was updated, reload to get the current course files.</p>
    <div className="completion-actions">
      <button className="btn btn-primary" onClick={onRetry}>{retryLabel}</button>
      <button className="btn btn-ghost" disabled={unsafeToReload} onClick={() => window.location.reload()}>Reload app</button>
      <Link href="/" className="btn btn-ghost">Back to course</Link>
    </div>
    {unsafeToReload && <p role="status">Some changes are only in this tab's memory. Return to the course and sync them before reloading.</p>}
  </div>;
}
