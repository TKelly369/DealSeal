export default function PackagesPage() {
  return (
    <div>
      <h1>Package builder</h1>
      <div className="card">
        <p>Outputs: PDF bundles, JSON, XML — includes documents, metadata, audit</p>
        <p style={{ color: "var(--muted)" }}>
          API: POST /packages/jobs
        </p>
      </div>
    </div>
  );
}
