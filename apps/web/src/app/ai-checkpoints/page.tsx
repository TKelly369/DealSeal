import { PipelineStepStatus } from "@/lib/agents/types";

type Step = {
  id: number;
  title: string;
  status: PipelineStepStatus;
};

const STEPS: Step[] = [
  { id: 1, title: "Deal Creation", status: "PASS" },
  { id: 2, title: "AI State-Law Compliance Review", status: "PASS" },
  { id: 3, title: "Draft Authoritative Contract", status: "PASS" },
  { id: 4, title: "Pre-Consummation Green Checkpoint", status: "PASS" },
  { id: 5, title: "Signing/Locking Authoritative Record", status: "PENDING" },
  { id: 6, title: "Funding Package Generation", status: "PENDING" },
  { id: 7, title: "Dealer Additional Docs Auto-Populated", status: "PENDING" },
  { id: 8, title: "Filing/Title/Lien Checklist Completed", status: "PENDING" },
  { id: 9, title: "Second Green Checkpoint After Funding", status: "PENDING" },
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
            <div
              key={step.id}
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
          ))}
        </div>
      </section>
    </div>
  );
}
