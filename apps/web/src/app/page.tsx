import Link from "next/link";
import { DEMO_RECORDS } from "@/lib/demo-records";

export default function DashboardPage() {
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "2.5rem 1rem 3rem" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        <p className="badge ds-badge--verified" style={{ marginBottom: "0.75rem" }}>
          DealSeal is Live
        </p>
        <h1 style={{ marginBottom: "0.5rem", fontSize: "2rem" }}>DealSeal</h1>
        <p style={{ margin: 0, color: "var(--text-secondary)", maxWidth: 720 }}>
          Authoritative record demonstration dashboard for certified renderings and public verification.
        </p>
        <p style={{ margin: "0.75rem 0 0" }}>
          <Link className="btn btn-secondary" href="/ai-checkpoints">
            AI Compliance
          </Link>
        </p>
      </header>

      <section className="card">
        <p className="ds-card-title">Governing Records</p>
        <div style={{ display: "grid", gap: "0.85rem" }}>
          {DEMO_RECORDS.map((record) => (
            <Link
              key={record.id}
              href={`/records/${record.id}`}
              className="card"
              style={{
                display: "block",
                padding: "1rem",
                borderColor: "var(--border-bright)",
                background: "linear-gradient(165deg, var(--surface-elevated) 0%, var(--bg-mid) 100%)",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.06rem", color: "var(--text)" }}>{record.title}</h2>
              <p style={{ margin: "0.45rem 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                Parties: {record.parties}
              </p>
              <p style={{ margin: "0.2rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
                Effective date: {record.effectiveAt}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
