import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function AdminAuditPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/admin/audit");
  if (session.user.role !== "ADMIN" && session.user.role !== "PLATFORM_ADMIN") redirect("/dashboard");

  const certs = await prisma.preFundingValidationCertificate.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Audit Trail & Validation Certificates</h2>
      <table className="ds-table">
        <thead>
          <tr>
            <th>Deal</th>
            <th>Status</th>
            <th>Audit Ref</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {certs.map((cert) => (
            <tr key={cert.id}>
              <td>{cert.dealId}</td>
              <td>{cert.status}</td>
              <td>{cert.auditRef}</td>
              <td>{new Date(cert.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
