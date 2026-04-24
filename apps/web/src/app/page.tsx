import Link from "next/link";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type DemoResponse = {
  ok: boolean;
  organization?: { name: string; slug: string };
  metrics?: {
    transactions: number;
    auditEvents: number;
    states: { state: string; count: number }[];
  };
  latestTransactions?: {
    id: string;
    publicId: string;
    state: string;
    buyerName: string;
    amountFinanced: string;
    termMonths: number | null;
    createdAt: string;
  }[];
  message?: string;
};

async function loadDemo(): Promise<DemoResponse | null> {
  try {
    const res = await fetch(`${apiBase}/demo`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as DemoResponse;
  } catch {
    return null;
  }
}

export default async function Home() {
  const demo = await loadDemo();
  const states = demo?.metrics?.states ?? [];
  const latest = demo?.latestTransactions ?? [];

  return (
    <main style={{ maxWidth: 1060, margin: "0 auto", padding: "2.5rem 1rem 4rem" }}>
      <section className="card" style={{ marginBottom: "1rem" }}>
        <p className="badge">DealSeal Live Demo</p>
        <h1 style={{ marginTop: "0.8rem" }}>Transaction Authority for Auto Finance</h1>
        <p style={{ color: "var(--muted)", lineHeight: 1.6, maxWidth: 780, fontSize: 15 }}>
          Auto-finance deals demand end-to-end control and audit accountability. DealSeal gives dealers transaction authority,
          lenders compliance visibility, and investors complete transparency—from contract to post-funding closure.
        </p>
        <div className="row" style={{ marginTop: "1rem" }}>
          <Link className="btn" href="/dashboard">
            Explore Dashboard
          </Link>
          <a className="btn btn-secondary" href={`${apiBase}/health`} target="_blank" rel="noreferrer">
            System Health
          </a>
        </div>
      </section>

      <section className="card" style={{ marginBottom: "1rem", background: "linear-gradient(180deg, #162335 0%, #0f1a28 100%)" }}>
        <h3 style={{ marginTop: 0, marginBottom: "0.8rem" }}>What You&apos;ll See Here</h3>
        <div className="row" style={{ gap: "1rem" }}>
          <div style={{ flex: "1 1 200px" }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>📊 Pipeline Metrics</p>
            <p style={{ margin: "0.4rem 0 0", color: "var(--muted)", fontSize: 13 }}>Active deals, audit events, and transaction states</p>
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>🔍 Deal Visibility</p>
            <p style={{ margin: "0.4rem 0 0", color: "var(--muted)", fontSize: 13 }}>Full lifecycle tracking and compliance status</p>
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>✓ Audit Trail</p>
            <p style={{ margin: "0.4rem 0 0", color: "var(--muted)", fontSize: 13 }}>Every action logged, traceable, and accountable</p>
          </div>
        </div>
      </section>

      {!demo && (
        <section className="card" style={{ marginBottom: "1rem" }}>
          <h3>Demo data is temporarily unavailable</h3>
          <p style={{ color: "var(--muted)", margin: "0.3rem 0 0.8rem" }}>
            The web experience is online, but demo records could not be loaded from the API.
            Confirm the backend is running and seeded, then refresh.
          </p>
          <div className="row">
            <a className="btn btn-secondary" href={`${apiBase}/health`} target="_blank" rel="noreferrer">
              Check API Health
            </a>
            <a className="btn btn-secondary" href={`${apiBase}/demo`} target="_blank" rel="noreferrer">
              Check Demo Endpoint
            </a>
          </div>
        </section>
      )}

      <section className="row" style={{ marginBottom: "1rem" }}>
        <article className="card" style={{ flex: "1 1 220px" }}>
          <h3 style={{ margin: "0 0 0.5rem", fontSize: 14 }}>Dealer Org</h3>
          <p style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{demo?.organization?.name ?? "Demo Dealer"}</p>
          <p style={{ color: "var(--muted)", marginTop: 6, fontSize: 13 }}>Operating this demo pipeline</p>
        </article>
        <article className="card" style={{ flex: "1 1 220px" }}>
          <h3 style={{ margin: "0 0 0.5rem", fontSize: 14 }}>Active Deals</h3>
          <p style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{demo?.metrics?.transactions ?? 0}</p>
          <p style={{ color: "var(--muted)", marginTop: 6, fontSize: 13 }}>In pipeline and under management</p>
        </article>
        <article className="card" style={{ flex: "1 1 220px" }}>
          <h3 style={{ margin: "0 0 0.5rem", fontSize: 14 }}>Audit Trail</h3>
          <p style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{demo?.metrics?.auditEvents ?? 0}</p>
          <p style={{ color: "var(--muted)", marginTop: 6, fontSize: 13 }}>Traceable transactions and actions</p>
        </article>
      </section>

      <section className="card" style={{ marginBottom: "1rem" }}>
        <h3 style={{ margin: "0 0 0.8rem" }}>Pipeline Stages</h3>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0, marginBottom: "1rem" }}>Deals move through distinct states: evaluation, approval, execution, and closure.</p>
        {states.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>
            No pipeline data available yet.
          </p>
        ) : (
          <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
            {states.map((entry) => (
              <div key={entry.state} className="badge" style={{ fontSize: 13 }}>
                <strong>{entry.count}</strong> {entry.state}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h3 style={{ margin: "0 0 0.8rem" }}>Recent Activity</h3>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0, marginBottom: "1rem" }}>Latest transactions showing deal progression through the pipeline.</p>
        {latest.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>
            No transaction data available yet.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {latest.map((tx) => (
              <div key={tx.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "0.8rem", background: "linear-gradient(180deg, rgba(46, 111, 184, 0.08) 0%, rgba(17, 28, 43, 0.8) 100%)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{tx.publicId}</p>
                    <p style={{ margin: "0.4rem 0 0", color: "var(--muted)", fontSize: 13 }}>
                      {tx.buyerName}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontWeight: 500, fontSize: 13 }}>${parseFloat(tx.amountFinanced).toLocaleString()}</p>
                    <p style={{ margin: "0.3rem 0 0", color: "var(--muted)", fontSize: 12 }}>
                      {tx.termMonths} months · {new Date(tx.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <p style={{ margin: "0.5rem 0 0", fontSize: 13, fontWeight: 500, color: "var(--accent)" }}>
                  Status: {tx.state}
                </p>
              </div>
            ))}
          </div>
        )}
        {demo?.message && <p style={{ color: "var(--danger)", marginTop: "0.8rem", fontSize: 13 }}>{demo.message}</p>}
      </section>
    </main>
  );
}
