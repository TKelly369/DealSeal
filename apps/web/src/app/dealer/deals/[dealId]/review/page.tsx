import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { FundingValidationService } from "@/lib/services/funding.service";

export default async function DealerDealReviewPage({ params }: { params: Promise<{ dealId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { dealId } = await params;
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      authoritativeContract: true,
      generatedDocuments: true,
      prefundingValidationCertificate: true,
    },
  });
  if (!deal || deal.dealerId !== session.user.workspaceId) {
    redirect("/dealer/dashboard");
  }

  const certificate =
    deal.prefundingValidationCertificate ?? (await FundingValidationService.generatePrefundingCertificate(dealId));
  const blockers = Array.isArray(certificate.blockers) ? certificate.blockers : [];

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Deal Review</h1>
      <div className="card">
        <p className="ds-card-title">Authoritative Contract Hash</p>
        <p style={{ color: "var(--text-secondary)", wordBreak: "break-all" }}>
          {deal.authoritativeContract?.contentHash ?? "N/A"}
        </p>
      </div>
      <div className="card">
        <p className="ds-card-title">Generated Docs</p>
        <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
          {deal.generatedDocuments.map((doc) => (
            <li key={doc.id}>
              {doc.type} · v{doc.version}
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <p className="ds-card-title">Pre-funding Certificate</p>
        <p>Status: {certificate.status}</p>
        {blockers.length > 0 ? (
          <ul style={{ color: "#fecaca", paddingLeft: "1.2rem" }}>
            {blockers.map((b, idx) => (
              <li key={`${idx}-${String(b)}`}>{String(b)}</li>
            ))}
          </ul>
        ) : (
          <p style={{ color: "var(--verified)" }}>No blockers detected.</p>
        )}
      </div>
      <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
        Submissions use the custody workflow. Complete RISC sequencing on the lifecycle page, then return here for certificate checks.
      </p>
      <Link href={`/dealer/deals/${dealId}`} className="btn">
        Deal lifecycle &amp; custody
      </Link>
      <Link href="/dealer/dashboard">Back to dashboard</Link>
    </div>
  );
}
