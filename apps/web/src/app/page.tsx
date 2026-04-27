import Link from "next/link";

const entryCards = [
  {
    icon: "🏢",
    title: "Enter as Dealer",
    description:
      "Create deals, generate required dealer documents, manage funding packages, and maintain compliance through AI-assisted workflows.",
    href: "/dashboard",
  },
  {
    icon: "🏦",
    title: "Enter as Lender",
    description:
      "Review authoritative contracts, validate funding packages, verify certified renderings, and ensure downstream document integrity.",
    href: "/dashboard",
  },
  {
    icon: "🛡️",
    title: "Enter as Admin",
    description: "Manage system custody, audit trails, compliance checkpoints, and the full DealSeal platform infrastructure.",
    href: "/admin",
  },
];

export default function HomePage() {
  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#ffffff" }}>
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "2.5rem 1rem 3rem" }}>
        <section
          style={{
            background: "linear-gradient(180deg, #000000 0%, #0a0a0a 100%)",
            border: "1px solid #222222",
            borderRadius: "14px",
            padding: "2.2rem 1.5rem",
            marginBottom: "1.5rem",
          }}
        >
          <div
            style={{
              display: "inline-block",
              fontSize: "clamp(2.2rem, 8vw, 4.6rem)",
              fontWeight: 900,
              letterSpacing: "0.08em",
              color: "#ffffff",
              borderBottom: "6px solid #dc2626",
              paddingBottom: "0.25rem",
            }}
          >
            DEALSEAL
          </div>
          <p style={{ margin: "0.9rem 0 0", fontSize: "1.15rem", color: "#e0e0e0", fontWeight: 600 }}>
            Contract Authority Platform
          </p>
          <p style={{ margin: "1rem 0 0", color: "#c0c0c0", lineHeight: 1.7, maxWidth: 980 }}>
            DealSeal enforces the legal and evidentiary hierarchy from Authoritative Governing Record through
            Certified Visual Rendering to Non-Authoritative Convenience Copies. One authoritative record. Immutable
            contract data. Cryptographic hash. Audit trail. No downstream document drift.
          </p>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "0.95rem",
            marginBottom: "1.6rem",
          }}
        >
          {entryCards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="dealseal-entry-card"
              style={{
                display: "block",
                padding: "1.15rem 1.05rem",
              }}
            >
              <p style={{ margin: 0, fontSize: "1.28rem" }}>{card.icon}</p>
              <h2 style={{ margin: "0.45rem 0 0", fontSize: "1.08rem", color: "#ffffff" }}>{card.title}</h2>
              <p style={{ margin: "0.5rem 0 0", color: "#c0c0c0", fontSize: "0.9rem", lineHeight: 1.55 }}>
                {card.description}
              </p>
              <p style={{ margin: "0.75rem 0 0", color: "#e0e0e0", fontWeight: 700, fontSize: "0.86rem" }}>
                Enter
              </p>
            </Link>
          ))}
        </section>

        <section className="card">
          <h2 style={{ margin: 0, fontSize: "1.4rem", color: "#ffffff" }}>Platform</h2>
          <div style={{ display: "grid", gap: "1.1rem", marginTop: "1rem" }}>
            <div>
              <p className="ds-card-title">Compliance &amp; Authority</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                <Link href="/ai-checkpoints">AI Checkpoints</Link>
                <Link href="/records/demo-record-001">Certified Rendering Demo</Link>
                <Link href="/verify">Verify a Record</Link>
              </div>
            </div>
            <div>
              <p className="ds-card-title">System</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                <Link href="/dashboard">Dashboard</Link>
                <Link href="/audit">Audit Log</Link>
                <Link href="/documents">Documents</Link>
                <Link href="/integrations">Integrations</Link>
                <Link href="/billing">Billing</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer
        style={{
          borderTop: "1px solid #222222",
          background: "#000000",
          color: "#c0c0c0",
          textAlign: "center",
          padding: "1.25rem 1rem 1.5rem",
        }}
      >
        <p style={{ margin: 0 }}>© 2026 DealSeal. All rights reserved.</p>
        <p style={{ margin: "0.35rem 0 0", color: "#a0a0a0" }}>Contract Authority Platform</p>
      </footer>
    </div>
  );
}
