import Link from "next/link";
import "./pages-mobile.css";

export default function NotFound() {
  return (
    <main className="container">
      <div className="center-card">
        <p className="big-emoji">🧭</p>
        <h1>Page not found</h1>
        <p>That page doesn&apos;t exist — but the course does.</p>
        <div className="page-actions">
          <Link href="/" className="btn btn-primary">
            Back to course
          </Link>
        </div>
      </div>
    </main>
  );
}
