export default function WorkspacePage() {
  return (
    <div>
      <h1>Transaction workspace</h1>
      <div className="card">
        <p>
          Open a specific transaction (UUID from <code>npx prisma db seed</code> console
          output) to use PATCH forms, document upload intents, package jobs, and audit
          timeline.
        </p>
        <p style={{ color: "var(--muted)" }}>
          Navigate to <code>/workspace/&lt;transaction-uuid&gt;</code> (copy the id printed when you run{" "}
          <code>npx prisma db seed</code> in <code>apps/api</code>).
        </p>
      </div>
    </div>
  );
}
