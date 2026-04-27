import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ComplianceEngineService } from "@/lib/services/compliance.service";
import { ComplianceBadge } from "@/components/shared/ComplianceBadge";

export default async function LenderDealReviewPage({ params }: { params: Promise<{ dealId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { dealId } = await params;
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      dealer: { select: { name: true } },
      financials: true,
      vehicle: true,
      authoritativeContract: true,
    },
  });
  if (!deal || deal.lenderId !== session.user.workspaceId) redirect("/lender/intake");

  const lenderCompliance = await ComplianceEngineService.runLenderCompliance(dealId);

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Lender Deal Review</h1>
      <div className="card">
        <p className="ds-card-title">Dealer</p>
        <p>{deal.dealer.name}</p>
        <p className="ds-card-title">Contract Hash</p>
        <p style={{ wordBreak: "break-all" }}>{deal.authoritativeContract?.contentHash ?? "N/A"}</p>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Contract Integrity Validator</h3>
        <p>
          Status: <ComplianceBadge status={lenderCompliance.status} />
        </p>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Funding decision</h3>
        <p style={{ color: "var(--muted)" }}>
          Deal status is now driven by the legal lifecycle (disclosure through authoritative lock). Use the intake workflow for RISC clearance.
        </p>
        <Link href={`/lender/intake/${dealId}`} className="btn">
          Open intake workflow
        </Link>
      </div>
    </div>
  );
}
