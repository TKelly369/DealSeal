export function ComplianceBadge({ status }: { status: "COMPLIANT" | "WARNING" | "BLOCKED" }) {
  const cls =
    status === "COMPLIANT" ? "ds-badge--verified" : status === "WARNING" ? "ds-badge--warning" : "ds-badge--error";
  return <span className={`badge ${cls}`}>{status}</span>;
}
