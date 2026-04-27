"use client";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <div className="card" style={{ maxWidth: 640, margin: "2rem auto", textAlign: "center" }}>
      <h2>Something went wrong</h2>
      <p style={{ color: "var(--muted)" }}>We could not load the dashboard right now. Please try again.</p>
      <button type="button" onClick={reset}>
        Try Again
      </button>
    </div>
  );
}
