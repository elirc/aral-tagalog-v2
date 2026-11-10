"use client";

import Link from "next/link";
import { useEffect } from "react";
import "./pages-mobile.css";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // keep the real error visible to whoever debugs this from a device console
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="container">
      <div className="center-card">
        <p className="big-emoji">😵</p>
        <h2>Something went wrong</h2>
        <p>Your progress is saved on this device — nothing is lost.</p>
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
