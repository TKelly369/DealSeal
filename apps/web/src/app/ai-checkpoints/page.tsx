import { PipelineStepStatus } from "@/lib/agents/types";

type Step = {
  id: number;
  title: string;
  detail: string;
  requiredUploads?: string[];
  status: PipelineStepStatus;
};

const STEPS: Step[] = [
  {
    id: 1,
    title: "Deal Creation",
    detail: "Core buyer, vehicle, and contract terms are captured for deal jacket initialization.",
    status: "PASS",
  },
  {
    id: 2,
    title: "AI State-Law Compliance Review",
    detail: "AI checks disclosures and contract language alignment for state-specific requirements.",
    status: "PASS",
  },
  {
    id: 3,
    title: "Draft Authoritative Contract",
    detail: "RISC and related package is assembled before signatures and lock.",
    status: "PASS",
  },
  {
    id: 4,
    title: "Pre-First-Green Document Upload Gate",
    detail: "All signed at-sale paperwork must exist in the deal jacket before first green can pass.",
    requiredUploads: [
      "Signed disclosures",
      "Title application package",
      "Miscellaneous signed sales forms",
    ],
    status: "PENDING",
  },
  {
    id: 5,
    title: "First Green Checkpoint (Pre-Consummation)",
    detail: "Checkpoint clears only after required pre-funding document uploads are complete.",
    status: "PENDING",
  },
  {
    id: 6,
    title: "Signing/Locking Authoritative Record",
    detail: "Signed contract is uploaded and locked as the authoritative record.",
    status: "PENDING",
  },
  {
    id: 7,
    title: "Funding Package Generation",
    detail: "System generates downstream closing package and funding artifacts.",
    status: "PENDING",
  },
  {
    id: 8,
    title: "Post-Funding Assurance Upload Gate",
    detail: "After-funding proof is uploaded to support completion certainty and secondary market packaging.",
    requiredUploads: [
      "Proof of filings",
      "Add-on service payment receipts",
      "Any lender-required completion assurance records",
    ],
    status: "PENDING",
  },
  {
    id: 9,
    title: "Second Green Checkpoint (Post-Funding)",
    detail: "Second green clears when post-funding assurance records are present in the deal jacket.",
    status: "PENDING",
  },
  {
    id: 10,
    title: "Secondary Market Packaging Ready",
    detail: "Deal jacket is complete for lender pool inclusion and downstream audit defensibility.",
    status: "PENDING",
  },
];

function statusClass(status: PipelineStepStatus): string {
  if (status === "PASS") return "ds-badge--verified";
  if (status === "FAIL") return "ds-badge--error";
  return "ds-badge--warning";
}

export default function AiCheckpointsPage() {
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "2.2rem 1rem 3rem" }}>
      <header style={{ marginBottom: "1.3rem" }}>
        <p className="ds-card-title" style={{ marginBottom: "0.45rem" }}>
          DealSeal Compliance Orchestrator Agent
        </p>
        <h1 style={{ margin: 0, fontSize: "1.7rem" }}>Two Green Checkpoints Pipeline</h1>
        <p style={{ marginTop: "0.55rem", color: "var(--text-secondary)" }}>
          End-to-end AI compliance lifecycle for a deal from creation through post-funding validation.
        </p>
      </header>

      <section className="card">
        <div style={{ display: "grid", gap: "0.8rem" }}>
          {STEPS.map((step) => (
            <div key={step.id}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.9rem",
                  padding: "0.8rem 0.95rem",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  background: "linear-gradient(165deg, var(--surface-elevated) 0%, var(--bg-mid) 100%)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      border: "1px solid var(--border-bright)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.77rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {step.id}
                  </span>
                  <span style={{ color: "var(--text)" }}>{step.title}</span>
                </div>
                <span className={`badge ${statusClass(step.status)}`}>{step.status}</span>
              </div>
              <p style={{ margin: "0.15rem 0 0.15rem 2.2rem", color: "var(--text-secondary)", fontSize: "0.92rem" }}>
                {step.detail}
              </p>
              {step.requiredUploads?.length ? (
                <ul style={{ margin: "0 0 0.25rem 3.3rem", color: "var(--text-secondary)", fontSize: "0.88rem" }}>
                  {step.requiredUploads.map((doc) => (
                    <li key={doc}>{doc}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
