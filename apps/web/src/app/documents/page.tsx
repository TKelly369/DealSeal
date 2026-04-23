export default function DocumentsPage() {
  return (
    <div>
      <h1>Document panel</h1>
      <div className="card">
        <p>Ingestion: Upload → Validate → Classify → Accept/Reject → Store</p>
        <p style={{ color: "var(--muted)" }}>
          API: POST /documents · POST /documents/:id/versions?transactionId=
        </p>
      </div>
    </div>
  );
}
