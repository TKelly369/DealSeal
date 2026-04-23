export default function DiscrepanciesPage() {
  return (
    <div>
      <h1>Discrepancy view</h1>
      <div className="card">
        <p>Detect → Flag → Assign → Resolve → Revalidate</p>
        <p style={{ color: "var(--muted)" }}>
          Populated from transaction.discrepancies; overrides via /overrides
        </p>
      </div>
    </div>
  );
}
