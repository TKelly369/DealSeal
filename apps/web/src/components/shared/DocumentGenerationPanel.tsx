type DocRow = { id: string; type: string; version: number };

export function DocumentGenerationPanel({ docs }: { docs: DocRow[] }) {
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Generated Documents</h3>
      {docs.length === 0 ? (
        <p style={{ color: "var(--muted)", margin: 0 }}>No downstream documents generated yet.</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "var(--text-secondary)" }}>
          {docs.map((doc) => (
            <li key={doc.id}>
              {doc.type} · v{doc.version} · {doc.id}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
