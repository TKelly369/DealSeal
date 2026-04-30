import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminShellRole } from "@/lib/role-policy";
import { redirect } from "next/navigation";

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

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Document vault</h1>
      <p style={{ color: "var(--muted)" }}>Authoritative copy control, version traceability, and storage lineage.</p>
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
                <td style={{ fontSize: 12 }}>{doc.integritySha256?.slice(0, 16) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
