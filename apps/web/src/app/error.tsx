"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main-content" tabIndex={-1} className="container">
      <div className="center-card">
        <p className="big-emoji">😵</p>
        <h2>Something went wrong</h2>
        <p>Your progress is saved locally — nothing is lost.</p>
        <button type="button" className="btn btn-primary" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
