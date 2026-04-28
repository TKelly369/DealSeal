import Link from "next/link";
import Image from "next/image";

const pillars = [
  {
    title: "Build the deal fast",
    details:
      "Guided intake captures buyer, vehicle, lender, and structure details in one workflow, with defaults and validation that reduce rekeying and prevent incomplete files.",
  },
  {
    title: "Enforce legal compliance before submission",
    details:
      "State and lender checks run before packaging so missing disclosures, invalid terms, or policy conflicts are flagged early while the deal is still editable.",
  },
  {
    title: "Deliver lender-ready funding packages",
    details:
      "Authoritative documents, versioned records, and audit-linked metadata produce a cleaner package that lowers kickbacks, shortens stip cycles, and improves funding confidence.",
  },
];

const workflow = [
  "Select the lender link and create the canonical deal record.",
  "Run state plus lender compliance checks with actionable findings.",
  "Generate required downstream documents from controlled templates.",
  "Submit a traceable, audit-backed package ready for funding review.",
];

export default function DealBuilderLandingPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#ffffff" }}>
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "2.5rem 1rem 3rem" }}>
        <section
          style={{
            border: "1px solid #222222",
            borderRadius: 14,
            padding: "2rem 1.5rem",
            background: "linear-gradient(145deg, #0c0c0c 0%, #050505 100%)",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.75rem", letterSpacing: "0.12em", color: "#dc2626", fontWeight: 700 }}>
            DEALER WORKFLOW
          </p>
          <h1 style={{ margin: "0.5rem 0 0", fontSize: "clamp(1.5rem, 3.6vw, 2.2rem)" }}>
            Deal Builder: easy to structure, compliant to close, clean to fund
          </h1>
          <p style={{ margin: "0.9rem 0 0", color: "#b7b7b7", lineHeight: 1.7, maxWidth: 860 }}>
            DealSeal Deal Builder gives your team a single controlled process from intake to package delivery. It removes
            guesswork in deal setup, enforces legal and lender constraints before submission, and outputs a funding file
            lenders can review with confidence.
          </p>
          <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", marginTop: "1.1rem" }}>
            <Link className="btn" href="/login?next=/dealer/deals/new">
              Open Deal Builder
            </Link>
            <Link className="btn btn-secondary" href="/ai-checkpoints">
              View Compliance Engine
            </Link>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1rem",
            marginTop: "1.25rem",
          }}
        >
          {pillars.map((item) => (
            <article key={item.title} style={{ border: "1px solid #242424", borderRadius: 12, padding: "1rem 0.95rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.02rem" }}>{item.title}</h2>
              <p style={{ margin: "0.55rem 0 0", color: "#aeaeae", lineHeight: 1.6, fontSize: "0.93rem" }}>{item.details}</p>
            </article>
          ))}
        </section>

        <section className="card" style={{ marginTop: "1.25rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>How the system works</h2>
          <ol style={{ margin: 0, paddingLeft: "1.2rem", color: "#bdbdbd", lineHeight: 1.7 }}>
            {workflow.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section
          style={{
            marginTop: "1.25rem",
            border: "1px solid #232323",
            borderRadius: 12,
            background: "#090909",
            padding: "0.8rem",
          }}
        >
          <Image
            src="/brand/deal-builder-process.svg"
            alt="Deal Builder process: intake, compliance checks, document generation, funding-ready package"
            width={1200}
            height={520}
            style={{ width: "100%", height: "auto", borderRadius: 8 }}
            priority
          />
        </section>
      </main>
    </div>
  );
}
