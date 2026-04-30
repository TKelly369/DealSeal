import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminShellRole } from "@/lib/role-policy";
import { redirect } from "next/navigation";
import { EVaultRetentionService } from "@/lib/services/evault-retention.service";

export default async function AdminDocumentVaultPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login?next=/admin/document-vault");
  if (!isAdminShellRole(session.user.role)) redirect("/dashboard");

  const docs = await prisma.generatedDocument.findMany({
    orderBy: { createdAt: "desc" },
    take: 150,
    select: {
      id: true,
      dealId: true,
      type: true,
      documentType: true,
      version: true,
      isAuthoritative: true,
      integritySha256: true,
      lifecycleStage: true,
      storageProvider: true,
      storageKey: true,
      createdAt: true,
    },
  });
  const policies = await EVaultRetentionService.listPolicies(session.user.workspaceId);
  const authoritativeCount = docs.filter((d) => d.isAuthoritative).length;
  const withCustodialStorage = docs.filter((d) => d.storageKey && d.storageProvider).length;
  const hashMissing = docs.filter((d) => !d.integritySha256).length;

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Document eVault</h1>
      <p style={{ color: "var(--muted)" }}>
        Authoritative copy control, storage lineage, lifecycle-state custody, and retention-aware purge readiness.
      </p>
      <div className="ds-dashboard-bottom-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div className="card"><p className="ds-card-title">Vault docs loaded</p><h2>{docs.length}</h2></div>
        <div className="card"><p className="ds-card-title">Authoritative</p><h2>{authoritativeCount}</h2></div>
        <div className="card"><p className="ds-card-title">Custodial storage linked</p><h2>{withCustodialStorage}</h2></div>
        <div className="card"><p className="ds-card-title">Missing integrity hash</p><h2>{hashMissing}</h2></div>
      </div>
      <div className="card" style={{ marginTop: "1rem" }}>
        <h2 className="ds-card-title" style={{ marginTop: 0 }}>Legal retention policy map</h2>
        <table className="ds-table">
          <thead>
            <tr>
              <th>Record class</th>
              <th>Jurisdiction</th>
              <th>Retention years</th>
              <th>Mode</th>
              <th>Enabled</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((policy) => (
              <tr key={`${policy.recordClass}-${policy.jurisdiction}`}>
                <td>{policy.recordClass}</td>
                <td>{policy.jurisdiction}</td>
                <td>{policy.retentionYears}</td>
                <td>{policy.purgeMode}</td>
                <td>{policy.enabled ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <table className="ds-table">
          <thead>
            <tr>
              <th>Created</th>
              <th>Deal</th>
              <th>Type</th>
              <th>Version</th>
              <th>Authoritative</th>
              <th>Lifecycle</th>
              <th>Storage lineage</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id}>
                <td>{doc.createdAt.toLocaleString()}</td>
                <td>{doc.dealId}</td>
                <td>{doc.documentType ?? doc.type}</td>
                <td>{doc.version}</td>
                <td>{doc.isAuthoritative ? "Yes" : "No"}</td>
                <td>{doc.lifecycleStage}</td>
                <td style={{ fontSize: 12 }}>
                  {doc.storageProvider && doc.storageKey ? `${doc.storageProvider}:${doc.storageKey.slice(0, 24)}…` : "—"}
                </td>
                <td style={{ fontSize: 12 }}>{doc.integritySha256?.slice(0, 16) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
