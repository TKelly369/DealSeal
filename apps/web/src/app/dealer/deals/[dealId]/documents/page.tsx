import Link from "next/link";
import { loadDealerDealOrRedirect } from "../_load-dealer-deal";

export default async function DealerDealDocumentsPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const { deal } = await loadDealerDealOrRedirect(dealId);
  const docs = deal.generatedDocuments;

  return (
    <div className="ds-section-shell" style={{ maxWidth: 900 }}>
      <h2 style={{ marginTop: 0 }}>Documents</h2>
      <p style={{ color: "var(--muted)" }}>Generated and uploaded artifacts for this deal.</p>
      {docs.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No documents yet.</p>
      ) : (
        <table className="ds-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Version</th>
              <th>Authoritative</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>{d.documentType ?? d.type}</td>
                <td>{d.version}</td>
                <td>{d.isAuthoritative ? "Yes" : "—"}</td>
                <td>
                  {d.fileUrl ? (
                    <a href={d.fileUrl} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p style={{ marginTop: "1.25rem" }}>
        <Link href={`/dealer/deals/${dealId}`} className="btn btn-secondary">
          Upload &amp; actions in workspace
        </Link>
      </p>
    </div>
  );
}
