import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminShellRole } from "@/lib/role-policy";
import { redirect } from "next/navigation";

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login?next=/admin/dashboard");
  if (!isAdminShellRole(session.user.role)) redirect("/dashboard");

  let metrics = {
    deals: 0,
    openAlerts: 0,
    custodyEvents24h: 0,
    auditEvents24h: 0,
    pendingLinks: 0,
    organizations: 0,
  };
  let warning: string | null = null;
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [deals, openAlerts, custodyEvents24h, auditEvents24h, pendingLinks, organizations] = await Promise.all([
      prisma.deal.count(),
      prisma.dealAlert.count({ where: { status: "OPEN" } }),
      prisma.documentCustodyEvent.count({ where: { timestamp: { gte: since } } }),
      prisma.dealAuditEvent.count({ where: { createdAt: { gte: since } } }),
      prisma.dealerLenderLink.count({ where: { status: "PENDING" } }),
      prisma.workspace.count(),
    ]);
    metrics = { deals, openAlerts, custodyEvents24h, auditEvents24h, pendingLinks, organizations };
  } catch {
    warning = "Dashboard is running in degraded mode while database connectivity is limited.";
  }

  const cards = [
    { label: "System-wide deals", value: metrics.deals },
    { label: "Open alerts", value: metrics.openAlerts },
    { label: "Custody events (24h)", value: metrics.custodyEvents24h },
    { label: "Audit events (24h)", value: metrics.auditEvents24h },
    { label: "Pending dealer-lender links", value: metrics.pendingLinks },
    { label: "Organizations", value: metrics.organizations },
  ];

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Admin dashboard</h1>
      <p style={{ color: "var(--muted)" }}>
        System-wide activity, alert pressure, custody visibility, and relationship health.
      </p>
      {warning ? <p style={{ color: "#fecaca" }}>{warning}</p> : null}
      <div className="mini-grid">
        {cards.map((card) => (
          <div key={card.label} className="card">
            <p className="ds-card-title">{card.label}</p>
            <p style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
