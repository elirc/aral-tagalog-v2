import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="container">
      <div className="center-card">
        <p className="big-emoji">🧭</p>
        <h2>Page not found</h2>
        <p>That page doesn&apos;t exist — but the course does.</p>
        <Link href="/" className="btn btn-primary">
          Back to course
        </Link>
      </div>
    </main>
  );
}
