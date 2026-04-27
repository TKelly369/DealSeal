import { redirect } from "next/navigation";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { getAuditLogs } from "@/app/admin/actions";
import { AuditLogTable } from "@/components/admin/AuditLogTable";
import { prisma } from "@/lib/db";

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/admin/audit-logs");
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page || 1));
  const data = await getAuditLogs({ page, limit: 15 });
  const [custodyEvents, recentDocuments] = await Promise.all([
    prisma.documentCustodyEvent.findMany({
      orderBy: { timestamp: "desc" },
      take: 20,
      include: {
        deal: { select: { id: true, dealerId: true, lenderId: true } },
        document: { select: { id: true, documentType: true, version: true } },
      },
    }),
    prisma.generatedDocument.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { deal: { select: { id: true } } },
    }),
  ]);
  const actorIds = Array.from(new Set(custodyEvents.map((e) => e.actorUserId).filter(Boolean)));
  const actorUsers =
    actorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
  const actorById = new Map(actorUsers.map((u) => [u.id, u]));
  const now = new Date();
  const dateLabel = now.toLocaleDateString();
  const timeLabel = now.toLocaleTimeString([], { hour12: false });

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <Image
            src="/brand/dealseal-lockup-official.png"
            alt="DealSeal"
            width={180}
            height={40}
            priority
            style={{ height: "auto", width: "180px" }}
          />
          <span style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
            {dateLabel} · {timeLabel} (24h)
          </span>
        </div>
        <h2 style={{ marginTop: "0.85rem" }}>Admin Oversight: Documents, Custody, and Control</h2>
        <p style={{ color: "var(--muted)" }}>
          Monitor who entered or modified custody records and document events, with exact timestamps.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>System Audit Logs</h3>
        <AuditLogTable rows={data.rows} />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Custody Entry Monitor (Who + When)</h3>
        <table className="ds-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Role</th>
              <th>Event</th>
              <th>Deal</th>
              <th>Document</th>
            </tr>
          </thead>
          <tbody>
            {custodyEvents.map((e) => {
              const actor = actorById.get(e.actorUserId);
              return (
                <tr key={e.id}>
                  <td>{e.timestamp.toLocaleString([], { hour12: false })}</td>
                  <td>{actor?.name ?? actor?.email ?? e.actorUserId}</td>
                  <td>{e.actorRole}</td>
                  <td>{e.eventType}</td>
                  <td>{e.dealId}</td>
                  <td>{e.document?.documentType ?? "N/A"}{e.document?.version ? ` v${e.document.version}` : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Document Control Monitor</h3>
        <table className="ds-table">
          <thead>
            <tr>
              <th>Created</th>
              <th>Deal</th>
              <th>Type</th>
              <th>Version</th>
              <th>Authoritative</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            {recentDocuments.map((doc) => (
              <tr key={doc.id}>
                <td>{doc.createdAt.toLocaleString([], { hour12: false })}</td>
                <td>{doc.deal.id}</td>
                <td>{doc.documentType ?? doc.type}</td>
                <td>v{doc.version}</td>
                <td>{doc.isAuthoritative ? "Yes" : "No"}</td>
                <td>{doc.authoritativeContractHash ? doc.authoritativeContractHash.slice(0, 12) + "…" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
