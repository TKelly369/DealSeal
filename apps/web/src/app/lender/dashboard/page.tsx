import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DealService } from "@/lib/services/deal.service";
import { prisma } from "@/lib/db";

export default async function LenderDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/lender/login?next=/lender");
  const lenderId = session.user.workspaceId;
  let deals: Awaited<ReturnType<typeof DealService.listDealsForLender>> = [];
  let exceptions = 0;
  let dataWarning: string | null = null;
  try {
    deals = await DealService.listDealsForLender(lenderId);
    exceptions = await prisma.complianceCheck.count({
      where: { deal: { lenderId }, status: "BLOCKED" },
    });
  } catch (error) {
    console.error("[DealSeal] Lender dashboard data fallback", error);
    dataWarning = "Some dashboard data is temporarily unavailable. You can still access lender workflows.";
  }
  const awaitingRisc = deals.filter((d) => d.status === "RISC_UNSIGNED_REVIEW");
  const lockedOrDone = deals.filter(
    (d) =>
      d.status === "FIRST_GREEN_PASSED" ||
      d.status === "AUTHORITATIVE_LOCK" ||
      d.status === "GENERATING_CLOSING_PACKAGE" ||
      d.status === "CLOSING_PACKAGE_READY" ||
      d.status === "CONSUMMATED",
  );
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
          Receivables
        </Link>
        <Link href="/lender/pools" className="btn">
          Loan pools
        </Link>
        <Link href="/lender/rules" className="btn btn-secondary">
          Lender Rules
        </Link>
      </div>
      {dataWarning ? (
        <p style={{ marginTop: "0.8rem", color: "var(--muted)" }}>{dataWarning}</p>
      ) : null}
    </div>
  );
}
