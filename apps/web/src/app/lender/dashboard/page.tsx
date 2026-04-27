import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DealService } from "@/lib/services/deal.service";
import { prisma } from "@/lib/db";

export default async function LenderDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/lender/dashboard");
  const lenderId = session.user.workspaceId;
  const deals = await DealService.listDealsForLender(lenderId);
  const awaitingRisc = deals.filter((d) => d.status === "RISC_UNSIGNED_REVIEW");
  const lockedOrDone = deals.filter(
    (d) =>
      d.status === "AUTHORITATIVE_LOCK" ||
      d.status === "GENERATING_CLOSING_PACKAGE" ||
      d.status === "CLOSING_PACKAGE_READY" ||
      d.status === "CONSUMMATED",
  );
  const exceptions = await prisma.complianceCheck.count({
    where: { deal: { lenderId }, status: "BLOCKED" },
  });

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Lender Dashboard</h1>
      <div className="ds-dashboard-bottom-grid">
        <div className="card">
          <p className="ds-card-title">Awaiting RISC approval</p>
          <h2>{awaitingRisc.length}</h2>
        </div>
        <div className="card">
          <p className="ds-card-title">Locked / consummated</p>
          <h2>{lockedOrDone.length}</h2>
        </div>
        <div className="card">
          <p className="ds-card-title">Compliance Exceptions</p>
          <h2>{exceptions}</h2>
        </div>
      </div>
      <div className="row">
        <Link href="/lender/intake" className="btn">
          Intake Queue
        </Link>
        <Link href="/lender/assets" className="btn">
          Receivables &amp; pools
        </Link>
        <Link href="/lender/rules" className="btn btn-secondary">
          Lender Rules
        </Link>
      </div>
    </div>
  );
}
