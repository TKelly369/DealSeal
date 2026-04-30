import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminShellRole } from "@/lib/role-policy";
import { notFound, redirect } from "next/navigation";

export default async function AdminDealDetailPage({ params }: { params: Promise<{ dealId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  if (!isAdminShellRole(session.user.role)) redirect("/dashboard");
  const { dealId } = await params;

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true,
      status: true,
      state: true,
      createdAt: true,
      updatedAt: true,
      dealer: { select: { name: true } },
      lender: { select: { name: true } },
      _count: {
        select: {
          generatedDocuments: true,
          custodyEvents: true,
          complianceChecks: true,
          comments: true,
        },
      },
    },
  });
  if (!deal) notFound();

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Deal {deal.id}</h1>
      <p style={{ color: "var(--muted)" }}>
        {deal.dealer?.name ?? "Unknown dealer"} → {deal.lender?.name ?? "Unassigned lender"} · {deal.status}
      </p>
      <div className="mini-grid">
        <div className="card">
          <p className="ds-card-title">Generated docs</p>
          <p style={{ margin: 0 }}>{deal._count.generatedDocuments}</p>
        </div>
        <div className="card">
          <p className="ds-card-title">Custody events</p>
          <p style={{ margin: 0 }}>{deal._count.custodyEvents}</p>
        </div>
        <div className="card">
          <p className="ds-card-title">Compliance checks</p>
          <p style={{ margin: 0 }}>{deal._count.complianceChecks}</p>
        </div>
        <div className="card">
          <p className="ds-card-title">Comments</p>
          <p style={{ margin: 0 }}>{deal._count.comments}</p>
        </div>
      </div>
      <div className="row" style={{ gap: "0.75rem", marginTop: "1rem" }}>
        <Link className="btn btn-secondary" href={`/admin/audit/${deal.id}`}>
          Open audit timeline
        </Link>
        <Link className="btn btn-secondary" href="/admin/document-vault">
          Open document vault
        </Link>
      </div>
    </div>
  );
}
