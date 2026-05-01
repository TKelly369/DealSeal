import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminShellRole } from "@/lib/role-policy";
import { redirect } from "next/navigation";

function isMissingCustodyEventsTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as {
    code?: unknown;
    meta?: { modelName?: unknown; table?: unknown };
    message?: unknown;
  };
  if (maybe.code !== "P2021") return false;
  const modelName = typeof maybe.meta?.modelName === "string" ? maybe.meta.modelName : "";
  const tableName = typeof maybe.meta?.table === "string" ? maybe.meta.table : "";
  const message = typeof maybe.message === "string" ? maybe.message : "";
  return (
    modelName.includes("DocumentCustodyEvent") ||
    tableName.toLowerCase().includes("documentcustodyevent") ||
    tableName.toLowerCase().includes("document_custody_event") ||
    message.includes("DocumentCustodyEvent") ||
    message.toLowerCase().includes("document_custody_event")
  );
}

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
  const warnings: string[] = [];
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [deals, openAlerts, custodyEvents24h, auditEvents24h, pendingLinks, organizations] = await Promise.all([
    prisma.deal.count().catch(() => {
      warnings.push("Some dashboard metrics are temporarily unavailable.");
      return 0;
    }),
    prisma.dealAlert.count({ where: { status: "OPEN" } }).catch(() => {
      warnings.push("Some dashboard metrics are temporarily unavailable.");
      return 0;
    }),
    prisma.documentCustodyEvent.count({ where: { timestamp: { gte: since } } }).catch((error) => {
      if (isMissingCustodyEventsTableError(error)) {
        warnings.push("Custody metrics are unavailable until database migrations are deployed.");
      } else {
        warnings.push("Some dashboard metrics are temporarily unavailable.");
      }
      return 0;
    }),
    prisma.dealAuditEvent.count({ where: { createdAt: { gte: since } } }).catch(() => {
      warnings.push("Some dashboard metrics are temporarily unavailable.");
      return 0;
    }),
    prisma.dealerLenderLink.count({ where: { status: "PENDING" } }).catch(() => {
      warnings.push("Some dashboard metrics are temporarily unavailable.");
      return 0;
    }),
    prisma.workspace.count().catch(() => {
      warnings.push("Some dashboard metrics are temporarily unavailable.");
      return 0;
    }),
  ]);
  metrics = { deals, openAlerts, custodyEvents24h, auditEvents24h, pendingLinks, organizations };
  warning = warnings[0] ?? null;

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
