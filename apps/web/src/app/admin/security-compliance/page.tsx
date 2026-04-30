import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminShellRole } from "@/lib/role-policy";
import { redirect } from "next/navigation";
import { TrustComplianceService } from "@/lib/services/trust-compliance.service";

export default async function AdminSecurityCompliancePage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login?next=/admin/security-compliance");
  if (!isAdminShellRole(session.user.role)) redirect("/dashboard");

  const [pendingEvidence, openIncidents, openVulnerabilities, overduePolicies, reports] = await Promise.all([
    prisma.complianceEvidence.count({ where: { status: { in: ["pending", "needs_update", "expired"] } } }),
    prisma.securityIncident.count({ where: { status: { not: "closed" } } }),
    prisma.vulnerabilityFinding.count({ where: { status: { in: ["open", "accepted_risk"] } } }),
    prisma.securityPolicy.count({ where: { nextReviewAt: { lt: new Date() } } }),
    prisma.sOC2ReadinessReport.findMany({ orderBy: { reportDate: "desc" }, take: 30 }),
  ]);

  async function runReadinessReportAction() {
    "use server";
    const current = await auth();
    if (!current?.user || !isAdminShellRole(current.user.role)) return;
    await TrustComplianceService.generateSoc2ReadinessSummary(current.user.id);
  }

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>DealSeal Trust, Security & Compliance Control Center</h1>
      <p style={{ color: "var(--muted)", maxWidth: 900 }}>
        SOC 2 Type II readiness command center across Security, Confidentiality, Availability, Processing Integrity, and
        Privacy controls. Use API endpoints under <code>/api/admin/soc2/controls</code> for automation workflows.
      </p>

      <div className="ds-dashboard-bottom-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div className="card"><p className="ds-card-title">Pending evidence</p><h2>{pendingEvidence}</h2></div>
        <div className="card"><p className="ds-card-title">Open incidents</p><h2>{openIncidents}</h2></div>
        <div className="card"><p className="ds-card-title">Open vulnerabilities</p><h2>{openVulnerabilities}</h2></div>
        <div className="card"><p className="ds-card-title">Overdue policies</p><h2>{overduePolicies}</h2></div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h2 className="ds-card-title" style={{ marginTop: 0 }}>SOC 2 readiness report</h2>
        <form action={runReadinessReportAction}>
          <button className="btn" type="submit">Generate readiness snapshot</button>
        </form>
        <table className="ds-table" style={{ width: "100%", marginTop: "0.85rem" }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Evidence status</th>
              <th>Readiness score</th>
              <th>Remediation</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>{r.reportDate.toLocaleString()}</td>
                <td>{r.controlCategory}</td>
                <td>{r.evidenceStatus}</td>
                <td>{r.readinessScore}%</td>
                <td>{r.remediationStatus ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
