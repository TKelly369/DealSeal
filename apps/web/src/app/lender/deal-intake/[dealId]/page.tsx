import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  isCreditReportDocument,
  lenderCreditReportDownloadAllowed,
  lenderCreditReportViewAllowed,
} from "@/lib/credit-report-policy";
import { normalizeIntakeFilter } from "@/lib/lender-intake-filters";
import { redirect } from "next/navigation";
import { DealWorkflowService } from "@/lib/services/deal-workflow.service";
import { lenderFinalRISCFormAction, approveAmendmentIntakeFormAction, rejectAmendmentIntakeFormAction } from "./actions";
import { prisma } from "@/lib/db";
import { CommentService } from "@/lib/services/comment.service";
import { LenderIntakeWithActivity } from "./LenderIntakeWithActivity";

export default async function LenderDealIntakeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ dealId: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/lender/login?next=/lender/deal-intake");
  const { dealId } = await params;
  const filter = normalizeIntakeFilter((await searchParams).filter);
  const queueHref =
    filter === "all" ? "/lender/deal-intake" : `/lender/deal-intake?filter=${encodeURIComponent(filter)}`;
  const deal = await DealWorkflowService.getDealForActor(dealId, session.user.workspaceId, "lender");
  if (!deal) redirect("/lender/deal-intake");
  const pendingAmendments = await prisma.amendment.findMany({
    where: { dealId, status: "PENDING_LENDER_APPROVAL" },
    orderBy: { createdAt: "desc" },
    include: { requestingUser: { select: { name: true, email: true } } },
  });

  const unsigned = deal.generatedDocuments
    .filter((d) => d.documentType === "RISC_UNSIGNED")
    .sort((a, b) => b.version - a.version)[0];

  const creditReports = deal.generatedDocuments.filter(isCreditReportDocument).sort((a, b) => b.version - a.version);
  const ruleProfile = deal.dealerLenderLink?.lenderRuleProfile;
  const canViewCredit = lenderCreditReportViewAllowed(ruleProfile);
  const canDownloadCredit = lenderCreditReportDownloadAllowed(ruleProfile);

  const timeline = await CommentService.listTimelineForDeal(
    dealId,
    deal.custodyEvents.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      actorRole: e.actorRole,
      timestamp: e.timestamp,
      metadata: e.metadata,
    })),
  );

  return (
    <LenderIntakeWithActivity dealId={dealId} timeline={timeline} currentUserId={session.user.id}>
      <div className="ds-section-shell" style={{ maxWidth: "100%" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <h1 style={{ marginTop: 0 }}>Deal intake</h1>
          <Link href={queueHref} className="btn btn-secondary" style={{ fontSize: "0.85rem" }}>
            Queue
          </Link>
        </div>
        <p style={{ color: "var(--muted)" }}>
          Status: <strong>{deal.status}</strong> · State: <strong>{deal.state}</strong>
        </p>

        <div className="card" style={{ borderColor: "rgba(56, 189, 248, 0.35)" }}>
          <h2 style={{ marginTop: 0 }}>Dealer-uploaded credit report</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: 0 }}>
            DealSeal does <strong>not</strong> pull credit. When the dealer uploads a bureau or in-house credit file (green
            stage: <code>CREDIT_REPORT_UPLOAD</code>), it appears here. Every view or download is written to custody and
            the deal audit chain.
          </p>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Link policy: view {canViewCredit ? "allowed" : <strong style={{ color: "#f87171" }}>disabled</strong>} ·
            download {canDownloadCredit ? "allowed" : <strong style={{ color: "#f87171" }}>disabled</strong>} (
            <code>lenderRuleProfile.allowLenderCreditReportView / allowLenderCreditReportDownload</code>).
          </p>
          {creditReports.length === 0 ? (
            <p style={{ marginBottom: 0, color: "var(--muted)" }}>No credit report documents on this deal yet.</p>
          ) : (
            <ul style={{ margin: "0.75rem 0 0", paddingLeft: "1.1rem" }}>
              {creditReports.map((d) => (
                <li key={d.id} style={{ marginBottom: "0.5rem" }}>
                  <span style={{ fontWeight: 600 }}>v{d.version}</span>
                  <span style={{ color: "var(--muted)", fontSize: "0.82rem", marginLeft: "0.5rem" }}>
                    {d.documentType} · {d.createdAt.toLocaleString()}
                    {d.integritySha256 ? ` · sha256 ${d.integritySha256.slice(0, 12)}…` : null}
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", marginTop: "0.35rem" }}>
                    {d.storageKey && canViewCredit ? (
                      <a
                        className="btn btn-secondary"
                        style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem" }}
                        href={`/api/custody/download?dealId=${encodeURIComponent(dealId)}&documentId=${encodeURIComponent(d.id)}&mode=view`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View (audited)
                      </a>
                    ) : null}
                    {d.storageKey && canDownloadCredit ? (
                      <a
                        className="btn btn-secondary"
                        style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem" }}
                        href={`/api/custody/download?dealId=${encodeURIComponent(dealId)}&documentId=${encodeURIComponent(d.id)}`}
                      >
                        Download (audited)
                      </a>
                    ) : null}
                    {!d.storageKey ? (
                      <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>No custodial file key — mock URL only.</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p style={{ margin: "1rem 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
            Lender LOS hook: <code>GET /api/v1/deals/{"{dealId}"}/credit-report</code> (list) and{" "}
            <code>GET /api/v1/deals/{"{dealId}"}/credit-report/{"{documentId}"}</code> (binary). Requires API key with{" "}
            <code>deals:read</code> or <code>credit_report:read</code> on a <strong>LENDER</strong> workspace. Ingest
            endpoint respects the same download permission flag.
          </p>
        </div>

        {pendingAmendments.length > 0 ? (
          <div className="card" style={{ borderColor: "#7c2d12" }}>
            <h2 style={{ marginTop: 0 }}>Pending amendment request</h2>
            {pendingAmendments.map((a) => (
              <div
                key={a.id}
                style={{ marginBottom: "0.75rem", paddingBottom: "0.75rem", borderBottom: "1px solid #333" }}
              >
                <p style={{ margin: 0, color: "#fdba74" }}>{a.reason.replace(/_/g, " ")}</p>
                <p style={{ margin: "0.35rem 0", fontSize: "0.88rem", color: "var(--text-secondary)" }}>
                  Requested by {a.requestingUser.name ?? a.requestingUser.email ?? a.requestingUserId} ·{" "}
                  {a.createdAt.toLocaleString()}
                </p>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <form action={approveAmendmentIntakeFormAction}>
                    <input type="hidden" name="dealId" value={dealId} />
                    <input type="hidden" name="amendmentId" value={a.id} />
                    <button type="submit" className="btn">
                      Approve amendment
                    </button>
                  </form>
                  <form action={rejectAmendmentIntakeFormAction}>
                    <input type="hidden" name="dealId" value={dealId} />
                    <input type="hidden" name="amendmentId" value={a.id} />
                    <button type="submit" className="btn btn-secondary">
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {deal.status === "RISC_UNSIGNED_REVIEW" ? (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Unsigned RISC review</h2>
            {unsigned?.fileUrl ? (
              <p>
                <a href={unsigned.fileUrl} target="_blank" rel="noreferrer">
                  View dealer unsigned RISC (mock)
                </a>
              </p>
            ) : (
              <p style={{ color: "#fecaca" }}>Unsigned RISC not found on file.</p>
            )}
            <form action={lenderFinalRISCFormAction} style={{ display: "grid", gap: "0.5rem", marginTop: "1rem" }}>
              <input type="hidden" name="dealId" value={dealId} />
              <label style={{ display: "grid", gap: "0.35rem" }}>
                Lender final RISC PDF
                <input type="file" name="file" required />
              </label>
              <button type="submit" className="btn">
                Approve &amp; upload final RISC
              </button>
            </form>
          </div>
        ) : null}

        {deal.status === "FIRST_GREEN_PASSED" ||
        deal.status === "AUTHORITATIVE_LOCK" ||
        deal.status === "GENERATING_CLOSING_PACKAGE" ||
        deal.status === "CLOSING_PACKAGE_READY" ||
        deal.status === "CONSUMMATED" ? (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Authoritative record (read-only)</h2>
            <p style={{ color: "var(--muted)" }}>Status: {deal.status}</p>
            <p className="ds-card-title">Authoritative hash</p>
            <p style={{ wordBreak: "break-all" }}>{deal.authoritativeContract?.authoritativeContractHash ?? "—"}</p>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Custody is sealed; no lender edits.</p>
            {deal.status === "CLOSING_PACKAGE_READY" || deal.status === "CONSUMMATED" ? (
              <p style={{ color: "#86efac", marginTop: "0.5rem", fontSize: "0.9rem" }}>
                Uniform Closing Package generated — all downstream docs reference this hash.
              </p>
            ) : null}
          </div>
        ) : null}

        {deal.status !== "RISC_UNSIGNED_REVIEW" &&
        deal.status !== "FIRST_GREEN_PASSED" &&
        deal.status !== "AUTHORITATIVE_LOCK" &&
        deal.status !== "GENERATING_CLOSING_PACKAGE" &&
        deal.status !== "CLOSING_PACKAGE_READY" &&
        deal.status !== "CONSUMMATED" ? (
          <div className="card">
            <p style={{ color: "var(--muted)" }}>
              This deal is not awaiting lender RISC approval in this stage. Open the dealer workflow or wait for an
              unsigned RISC submission.
            </p>
          </div>
        ) : null}

        <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          Use the Activity panel for custody events and team comments.
        </p>
      </div>
    </LenderIntakeWithActivity>
  );
}
