import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function LenderAlertsPage() {
  const session = await auth();
  if (!session?.user) redirect("/lender/login?next=/lender/alerts");
  const lenderId = session.user.workspaceId;

  let blocked = 0;
  let warning = 0;
  try {
    blocked = await prisma.complianceCheck.count({
      where: { deal: { lenderId }, status: "BLOCKED" },
    });
    warning = await prisma.complianceCheck.count({
      where: { deal: { lenderId }, status: "WARNING" },
    });
  } catch {
    /* prisma unavailable */
  }

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Alerts</h1>
      <p style={{ color: "var(--muted)", maxWidth: 640 }}>
        High-level compliance and operational signals for your book. Open a deal from Deal intake for full context.
      </p>
      <div className="ds-dashboard-bottom-grid">
        <div className="card">
          <p className="ds-card-title">Compliance blocked</p>
          <h2>{blocked}</h2>
        </div>
        <div className="card">
          <p className="ds-card-title">Compliance warnings</p>
          <h2>{warning}</h2>
        </div>
      </div>
      <div className="row" style={{ marginTop: "1rem" }}>
        <Link className="btn" href="/lender/deal-intake">
          Deal intake
        </Link>
        <Link className="btn btn-secondary" href="/lender/dashboard">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
