export default function ApprovalsPage() {
  return (
    <div>
      <h1>Approval flow</h1>
      <div className="card">
        <p>Sequence lock: Approval → Execution → Upload → Validation → Lock</p>
        <p style={{ color: "var(--muted)" }}>
          API: POST /approvals/transactions/:id/approve
        </p>
      </div>
    </div>
  );
}
