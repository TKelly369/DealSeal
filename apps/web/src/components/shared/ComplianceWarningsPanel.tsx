import { ComplianceResult } from "@/lib/services/types";
import { ComplianceBadge } from "@/components/shared/ComplianceBadge";

export function ComplianceWarningsPanel({ result }: { result: ComplianceResult | null }) {
  if (!result) return null;
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Compliance Output</h3>
      <p style={{ marginTop: 0 }}>
        Overall status: <ComplianceBadge status={result.status} />
      </p>
      <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
        {result.checks.map((check) => (
          <li key={check.id} style={{ marginBottom: "0.4rem", color: "var(--text-secondary)" }}>
            <strong>{check.ruleSet}</strong>: {check.explanation}
            {check.suggestedCorrection ? ` (Fix: ${check.suggestedCorrection})` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
