import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

const DEALER_TEMPLATE_LIBRARY = [
  { key: "INITIAL_DISCLOSURE_SIGNED", label: "Initial disclosure", group: "Disclosure" },
  { key: "UCSP_BUYERS_ORDER", label: "Buyers order", group: "Deal jacket" },
  { key: "UCSP_STATE_DISCLOSURE", label: "State disclosure", group: "Deal jacket" },
  { key: "UCSP_TITLE_APPLICATION", label: "Title application", group: "Title/registration" },
  { key: "UCSP_ASSIGNMENT", label: "Assignment form", group: "Funding/control" },
  { key: "INSURANCE", label: "Proof of insurance", group: "Funding/control" },
  { key: "CREDIT_REPORT_UPLOAD", label: "Credit report upload", group: "Lender-conditional" },
];

type FolderBucket = "UNSIGNED_DEMO" | "OFFICIAL_SIGNED" | "PROBLEM_REVIEW";

function detectFolderBucket(doc: {
  documentType: string | null;
  fileUrl: string | null;
  valuesSnapshot: unknown;
}): FolderBucket {
  const snap =
    doc.valuesSnapshot && typeof doc.valuesSnapshot === "object" && !Array.isArray(doc.valuesSnapshot)
      ? (doc.valuesSnapshot as Record<string, unknown>)
      : {};
  const fromSnapshot = typeof snap.folderBucket === "string" ? snap.folderBucket : null;
  if (fromSnapshot === "UNSIGNED_DEMO" || fromSnapshot === "OFFICIAL_SIGNED" || fromSnapshot === "PROBLEM_REVIEW") {
    return fromSnapshot;
  }
  if (!doc.fileUrl) return "PROBLEM_REVIEW";
  if (doc.documentType === "RISC_SIGNED" || doc.documentType === "RISC_LENDER_FINAL" || doc.documentType === "UCSP_CLOSING_MANIFEST") {
    return "OFFICIAL_SIGNED";
  }
  return "UNSIGNED_DEMO";
}

export default async function DealerFilesPage() {
  const session = await auth();
  if (!session?.user) redirect("/dealer/login?next=/dealer/files");
  const dealerId = session.user.workspaceId;

  const deals = await prisma.deal.findMany({
    where: { dealerId },
    select: {
      id: true,
      status: true,
      state: true,
      updatedAt: true,
      lender: { select: { name: true } },
      generatedDocuments: {
        select: { id: true, documentType: true, fileUrl: true, createdAt: true, version: true, valuesSnapshot: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 80,
  });

  // AI filing assistant inference: classify each deal by the strongest missing-template signal.
  const rows = deals.map((deal) => {
    const present = new Set(deal.generatedDocuments.map((d) => d.documentType).filter(Boolean) as string[]);
    const suggested = DEALER_TEMPLATE_LIBRARY.filter((t) => !present.has(t.key)).slice(0, 4);
    const aiBucket =
      suggested.some((s) => s.group === "Disclosure")
        ? "Disclosure intake"
        : suggested.some((s) => s.group === "Deal jacket")
          ? "Deal jacket completion"
          : suggested.some((s) => s.group === "Funding/control")
            ? "Funding readiness"
            : "File complete";
    const folderCounts = deal.generatedDocuments.reduce(
      (acc, doc) => {
        const bucket = detectFolderBucket(doc);
        acc[bucket] += 1;
        return acc;
      },
      { UNSIGNED_DEMO: 0, OFFICIAL_SIGNED: 0, PROBLEM_REVIEW: 0 } as Record<FolderBucket, number>,
    );
    return { deal, suggested, aiBucket, folderCounts };
  });

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Files</h1>
      <p style={{ color: "var(--muted)", maxWidth: 640 }}>
        AI-assisted filing infrastructure organizes documents by deal, recommends missing templates, and keeps your file
        packet aligned to lender-ready workflow requirements.
      </p>
      <div className="card">
        <h2 className="ds-card-title" style={{ marginTop: 0 }}>
          Dealer template library
        </h2>
        <div style={{ display: "grid", gap: "0.4rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {DEALER_TEMPLATE_LIBRARY.map((t) => (
            <div key={t.key} style={{ border: "1px solid #333", borderRadius: 8, padding: "0.45rem 0.55rem" }}>
              <strong style={{ fontSize: "0.9rem" }}>{t.label}</strong>
              <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                {t.group} · <code>{t.key}</code>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="card" style={{ marginTop: "1rem" }}>
        <h2 className="ds-card-title" style={{ marginTop: 0 }}>
          AI file organizer by deal
        </h2>
        {rows.length === 0 ? (
          <p style={{ margin: 0, color: "var(--muted)" }}>No deals found for this workspace yet.</p>
        ) : (
          <table className="ds-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Deal</th>
                <th>Lender</th>
                <th>Status</th>
                <th>AI bucket</th>
                <th>Files</th>
                <th>Folder routing</th>
                <th>Suggested templates</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ deal, suggested, aiBucket, folderCounts }) => (
                <tr key={deal.id}>
                  <td>
                    <code>{deal.id.slice(0, 10)}…</code>
                    <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{deal.state}</div>
                  </td>
                  <td>{deal.lender.name}</td>
                  <td>{deal.status}</td>
                  <td>{aiBucket}</td>
                  <td>{deal.generatedDocuments.length}</td>
                  <td style={{ fontSize: "0.8rem" }}>
                    Unsigned Demo: {folderCounts.UNSIGNED_DEMO}
                    <br />
                    Official Signed: {folderCounts.OFFICIAL_SIGNED}
                    <br />
                    Problem Files:{" "}
                    <span style={{ color: folderCounts.PROBLEM_REVIEW > 0 ? "#fca5a5" : "var(--muted)" }}>
                      {folderCounts.PROBLEM_REVIEW}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.82rem" }}>
                    {suggested.length === 0
                      ? "No gaps detected"
                      : suggested.map((s) => s.label).join(", ")}
                  </td>
                  <td>
                    <Link className="btn btn-secondary" href={`/dealer/deals/${deal.id}`}>
                      Open deal
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="row" style={{ marginTop: "1rem" }}>
        <Link className="btn" href="/dealer/deals">
          Deals
        </Link>
        <Link className="btn btn-secondary" href="/dealer/deals/new">
          New deal
        </Link>
        <Link className="btn btn-secondary" href="/documents">
          Workspace documents
        </Link>
      </div>
    </div>
  );
}
