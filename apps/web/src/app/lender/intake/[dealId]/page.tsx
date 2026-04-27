import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DealWorkflowService } from "@/lib/services/deal-workflow.service";
import { lenderFinalRISCFormAction, approveAmendmentIntakeFormAction, rejectAmendmentIntakeFormAction } from "./actions";
import { prisma } from "@/lib/db";

export default async function LenderDealIntakeDetailPage({ params }: { params: Promise<{ dealId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/lender/intake");
  const { dealId } = await params;
  const deal = await DealWorkflowService.getDealForActor(dealId, session.user.workspaceId, "lender");
  if (!deal) redirect("/lender/intake");
  const pendingAmendments = await prisma.amendment.findMany({
    where: { dealId, status: "PENDING_LENDER_APPROVAL" },
    orderBy: { createdAt: "desc" },
    include: { requestingUser: { select: { name: true, email: true } } },
  });

  const unsigned = deal.generatedDocuments
    .filter((d) => d.documentType === "RISC_UNSIGNED")
    .sort((a, b) => b.version - a.version)[0];

  return (
    <div className="ds-section-shell">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ marginTop: 0 }}>Deal intake</h1>
        <Link href="/lender/intake" className="btn btn-secondary" style={{ fontSize: "0.85rem" }}>
          Queue
        </Link>
      </div>
      <p style={{ color: "var(--muted)" }}>
        Status: <strong>{deal.status}</strong> · State: <strong>{deal.state}</strong>
      </p>

      {pendingAmendments.length > 0 ? (
        <div className="card" style={{ borderColor: "#7c2d12" }}>
          <h2 style={{ marginTop: 0 }}>Pending amendment request</h2>
          {pendingAmendments.map((a) => (
            <div key={a.id} style={{ marginBottom: "0.75rem", paddingBottom: "0.75rem", borderBottom: "1px solid #333" }}>
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
          <p style={{ wordBreak: "break-all" }}>{deal.authoritativeContract?.contentHash ?? "—"}</p>
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
            This deal is not awaiting lender RISC approval in this stage. Open the dealer workflow or wait for an unsigned RISC submission.
          </p>
        </div>
      ) : null}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Custody timeline</h3>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.88rem", color: "var(--text-secondary)" }}>
          {deal.custodyEvents.map((e) => (
            <li key={e.id}>
              {e.timestamp.toLocaleString()} — {e.eventType} ({e.actorRole})
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
