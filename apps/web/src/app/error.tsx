"use client";

import Link from "next/link";
import "./pages-mobile.css";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="container">
      <div className="center-card">
        <p className="big-emoji">😵</p>
        <h2>Something went wrong</h2>
        <p>Your progress is saved locally — nothing is lost.</p>
        {/* no header on this screen, so offer a way home if retrying keeps failing */}
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={reset}>
            Try again
          </button>
          <Link href="/" className="btn btn-ghost">
            Back to course
          </Link>
        </div>
      </div>
    </main>
  );
}
