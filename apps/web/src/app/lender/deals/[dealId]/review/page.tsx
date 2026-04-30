import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ComplianceEngineService } from "@/lib/services/compliance.service";
import { ComplianceBadge } from "@/components/shared/ComplianceBadge";
import { isCreditReportDocument } from "@/lib/credit-report-policy";
import { submitFundingDecisionAction } from "./actions";

export default async function LenderDealReviewPage({ params }: { params: Promise<{ dealId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/lender/login?next=/lender/deals");
  const { dealId } = await params;
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      dealer: { select: { name: true } },
      financials: true,
      vehicle: true,
      authoritativeContract: true,
      generatedDocuments: { orderBy: { createdAt: "desc" } },
      complianceChecks: { orderBy: { createdAt: "desc" } },
      prefundingValidationCertificate: true,
      parties: { orderBy: { role: "asc" } },
      negotiableInstrument: true,
    },
  });
  if (!deal || deal.lenderId !== session.user.workspaceId) redirect("/lender/deal-intake");

  const lenderCompliance = await ComplianceEngineService.runLenderCompliance(dealId);
  const creditReports = deal.generatedDocuments.filter(isCreditReportDocument);
  const buyer = deal.parties.find((p) => p.role === "BUYER");
  const coBuyer = deal.parties.find((p) => p.role === "CO_BUYER");
  const assignmentStatus = deal.secondaryMarketStatus ?? "HELD_FOR_INVESTMENT";

  return (
    <div className="ds-section-shell">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ marginTop: 0 }}>Funding decision</h1>
        <Link href={`/lender/deal-intake/${dealId}`} className="btn btn-secondary">
          Intake workflow
        </Link>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Buyer summary</h3>
        <p style={{ margin: 0 }}>
          <strong>{buyer ? `${buyer.firstName} ${buyer.lastName}` : "N/A"}</strong> · {buyer?.address ?? "No address"}
        </p>
        <p style={{ color: "var(--muted)", marginTop: "0.45rem" }}>
          Co-buyer: {coBuyer ? `${coBuyer.firstName} ${coBuyer.lastName}` : "None"} · Credit tier: {buyer?.creditTier ?? "Not provided"}
        </p>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Vehicle summary</h3>
        <p style={{ margin: 0 }}>{deal.vehicle ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}` : "Vehicle details not captured."}</p>
        <p style={{ color: "var(--muted)", marginTop: "0.45rem" }}>
          VIN: {deal.vehicle?.vin ?? "N/A"} · Mileage: {deal.vehicle?.mileage ?? "N/A"} · Condition: {deal.vehicle?.condition ?? "N/A"}
        </p>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Deal numbers</h3>
        <p style={{ margin: 0 }}>
          Amount financed: {deal.financials ? `$${deal.financials.amountFinanced.toFixed(2)}` : "N/A"} · Total sale price:{" "}
          {deal.financials ? `$${deal.financials.totalSalePrice.toFixed(2)}` : "N/A"}
        </p>
        <p style={{ color: "var(--muted)", marginTop: "0.45rem" }}>
          Taxes: {deal.financials ? `$${deal.financials.taxes.toFixed(2)}` : "N/A"} · Fees:{" "}
          {deal.financials ? `$${deal.financials.fees.toFixed(2)}` : "N/A"}
        </p>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Uploaded documents</h3>
        {deal.generatedDocuments.length === 0 ? (
          <p style={{ margin: 0, color: "var(--muted)" }}>No documents uploaded yet.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {deal.generatedDocuments.slice(0, 12).map((d) => (
              <li key={d.id} style={{ marginBottom: "0.35rem" }}>
                {d.documentType ?? d.type} · v{d.version} · {d.createdAt.toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Authoritative contract rendering</h3>
        <p className="ds-card-title">Contract hash</p>
        <p style={{ wordBreak: "break-all" }}>{deal.authoritativeContract?.authoritativeContractHash ?? "Not generated"}</p>
        <p style={{ color: "var(--muted)" }}>
          Signature status: {deal.authoritativeContract?.signatureStatus ?? "N/A"} · Governing law:{" "}
          {deal.authoritativeContract?.governingLaw ?? "N/A"}
        </p>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Credit report presence</h3>
        <p style={{ margin: 0 }}>
          {creditReports.length > 0 ? `Present (${creditReports.length})` : "No dealer-uploaded credit report found."}
        </p>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Compliance status</h3>
        <p>
          Status: <ComplianceBadge status={lenderCompliance.status} />
        </p>
        {deal.complianceChecks.length > 0 ? (
          <p style={{ color: "var(--muted)", margin: 0 }}>
            Latest check: {deal.complianceChecks[0].ruleSet} · {deal.complianceChecks[0].status}
          </p>
        ) : null}
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Assignment status</h3>
        <p style={{ margin: 0 }}>{assignmentStatus}</p>
        <p style={{ color: "var(--muted)", marginTop: "0.45rem" }}>
          Negotiable instrument HDC: {deal.negotiableInstrument?.hdcStatus ?? "UNEVALUATED"}
        </p>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Clean Deal Certificate</h3>
        {deal.prefundingValidationCertificate ? (
          <>
            <p style={{ margin: 0 }}>Status: {deal.prefundingValidationCertificate.status}</p>
            <p style={{ color: "var(--muted)", marginTop: "0.45rem" }}>
              Audit ref: {deal.prefundingValidationCertificate.auditRef} · Contract hash:{" "}
              {deal.prefundingValidationCertificate.contractHash.slice(0, 16)}…
            </p>
          </>
        ) : (
          <p style={{ margin: 0, color: "var(--muted)" }}>No pre-funding certificate issued yet.</p>
        )}
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Decision actions</h3>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          Record lender decision state for this submitted deal. A dealer notification and audit entry are created.
        </p>
        <div style={{ display: "grid", gap: "0.65rem" }}>
          <form action={submitFundingDecisionAction} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <input type="hidden" name="dealId" value={dealId} />
            <input type="hidden" name="decision" value="APPROVE" />
            <input name="note" placeholder="Optional approval note" style={{ flex: "1 1 260px" }} />
            <button type="submit" className="btn">
              Approve
            </button>
          </form>
          <form action={submitFundingDecisionAction} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <input type="hidden" name="dealId" value={dealId} />
            <input type="hidden" name="decision" value="REJECT" />
            <input name="note" placeholder="Optional rejection note" style={{ flex: "1 1 260px" }} />
            <button type="submit" className="btn btn-secondary">
              Reject
            </button>
          </form>
          <form action={submitFundingDecisionAction} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <input type="hidden" name="dealId" value={dealId} />
            <input type="hidden" name="decision" value="CONDITION" />
            <input name="note" required placeholder="Condition details (required)" style={{ flex: "1 1 260px" }} />
            <button type="submit" className="btn btn-secondary">
              Condition
            </button>
          </form>
          <form action={submitFundingDecisionAction} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <input type="hidden" name="dealId" value={dealId} />
            <input type="hidden" name="decision" value="REQUEST_CORRECTION" />
            <input name="note" required placeholder="Requested correction details (required)" style={{ flex: "1 1 260px" }} />
            <button type="submit" className="btn btn-secondary">
              Request correction
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
