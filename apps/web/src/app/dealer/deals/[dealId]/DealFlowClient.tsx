"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  acknowledgeDisclosureFormAction,
  clearDealAlertFormAction,
  overrideDealAlertFormAction,
  requestAmendmentFormAction,
  retryAutopublishFormAction,
  submitUnsignedRISCAction,
  generateAiDealJacketDocsFormAction,
  uploadGreenStageDocAction,
  uploadSignedRISCAction,
} from "./actions";

export type ConsummatedSummary = {
  buyerLabel: string;
  amountFinanced: string;
  apr?: string;
  termMonths?: string;
  payment?: string;
} | null;

export type DealFlowSnapshot = {
  dealId: string;
  status: string;
  state: string;
  authoritativeHash: string | null;
  consummatedSummary: ConsummatedSummary;
  buyerDisplay: string;
  vehicleDisplay: string;
  amountFinancedDisplay: string;
  pendingAmendmentCount: number;
  documents: {
    id: string;
    documentType: string | null;
    fileUrl: string | null;
    version: number;
    isAuthoritative: boolean;
    authoritativeContractHash: string | null;
  }[];
  custodyEvents: {
    id: string;
    eventType: string;
    actorRole: string;
    timestamp: string;
    metadata: unknown;
  }[];
  alerts: {
    id: string;
    type: string;
    severity: string;
    status: string;
    title: string;
    message: string;
    resolutionNote: string | null;
    createdAt: string;
    audits: {
      id: string;
      action: string;
      actorRole: string | null;
      recipientUserId: string | null;
      note: string | null;
      createdAt: string;
    }[];
  }[];
  complianceChecks: { id: string; status: string; explanation: string; ruleSet: string }[];
  hdcStatus: string | null;
};

const STEPS = [
  "Deal details",
  "Gather unsigned deal jacket docs",
  "Review lender-final contract",
  "Upload signed contract",
  "AI aligns full package",
  "Download closing package",
] as const;

function SubmitLabel({ idle }: { idle: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "Working…" : idle}</>;
}

function hashSeal(hash: string | null | undefined) {
  if (!hash) return "—";
  return hash.slice(0, 8);
}

function activeStepIndex(status: string): number {
  switch (status) {
    case "DISCLOSURE_REQUIRED":
      return 0;
    case "AUTHORIZED_FOR_STRUCTURING":
    case "GREEN_STAGE":
      return 1;
    case "RISC_UNSIGNED_REVIEW":
      return 2;
    case "RISC_LENDER_FINAL":
      return 3;
    case "FIRST_GREEN_PASSED":
    case "AUTHORITATIVE_LOCK":
    case "GENERATING_CLOSING_PACKAGE":
      return 4;
    case "CLOSING_PACKAGE_READY":
    case "CONSUMMATED":
      return 5;
    default:
      return 0;
  }
}

export function DealFlowClient({
  deal,
  onRequestCommentOnEntity,
}: {
  deal: DealFlowSnapshot;
  onRequestCommentOnEntity?: (entityType: string, entityId: string) => void;
}) {
  const [printedExplained, setPrintedExplained] = useState(false);
  const finalRisc = deal.documents
    .filter((d) => d.documentType === "RISC_LENDER_FINAL")
    .sort((a, b) => b.version - a.version)[0];
  const hash = deal.authoritativeHash;
  const stepIdx = activeStepIndex(deal.status);
  const openAlerts = deal.alerts.filter((a) => a.status === "OPEN");

  return (
    <div className="ds-section-shell" style={{ maxWidth: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.35rem" }}>Your deal</h1>
        <Link href="/dealer/dashboard" className="btn btn-secondary" style={{ fontSize: "0.85rem" }}>
          Dashboard
        </Link>
      </div>
      <p style={{ color: "var(--muted)", margin: "0.5rem 0 1.25rem", fontSize: "0.9rem" }}>
        {deal.state} · pre-signature docs remain unsigned and estimated. Final contract signature triggers package alignment and lock.
      </p>

      <ol style={{ listStyle: "none", padding: 0, margin: "0 0 1.5rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        {STEPS.map((label, i) => {
          const done = i < stepIdx;
          const current = i === stepIdx;
          return (
            <li
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.82rem",
                color: done ? "var(--verified)" : current ? "var(--text)" : "var(--muted)",
                fontWeight: current ? 600 : 400,
              }}
            >
              <span
                style={{
                  width: "1.35rem",
                  height: "1.35rem",
                  borderRadius: "999px",
                  border: `2px solid ${done || current ? "#15803d" : "#444"}`,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.7rem",
                  flexShrink: 0,
                  background: done ? "#14532d" : "transparent",
                }}
              >
                {done ? "✓" : i + 1}
              </span>
              {label}
            </li>
          );
        })}
      </ol>

      {deal.complianceChecks.length > 0 ? (
        <section className="card" style={{ borderColor: "#3f3f46" }}>
          <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Compliance checks</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            HDC status: <strong>{deal.hdcStatus ?? "—"}</strong>
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0", display: "grid", gap: "0.5rem" }}>
            {deal.complianceChecks.map((c) => {
              const blocked = c.status === "BLOCKED";
              return (
                <li
                  key={c.id}
                  style={{
                    padding: "0.5rem 0.6rem",
                    borderRadius: 8,
                    border: `1px solid ${blocked ? "#b91c1c" : "#3f3f46"}`,
                    background: blocked ? "rgba(127, 29, 29, 0.2)" : "transparent",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                    <div>
                      <span className="badge" style={{ marginRight: 8 }}>
                        {c.ruleSet}
                      </span>
                      <span className="badge">{c.status}</span>
                      <p style={{ margin: "0.4rem 0 0", fontSize: "0.88rem", color: "var(--text-secondary)" }}>{c.explanation}</p>
                    </div>
                    {onRequestCommentOnEntity ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        title="Comment on this check"
                        style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", flexShrink: 0 }}
                        onClick={() => onRequestCommentOnEntity("COMPLIANCE_CHECK", c.id)}
                      >
                        Comment
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {deal.alerts.length > 0 ? (
        <section className="card" style={{ borderColor: openAlerts.length > 0 ? "#b45309" : "#14532d" }}>
          <h2 style={{ marginTop: 0, fontSize: "1rem" }}>AI math & legal alerts</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
            Alerts do not shut down the platform, but must be cleared or overridden with a file note before lock.
          </p>
          <div style={{ display: "grid", gap: "0.55rem", marginTop: "0.75rem" }}>
            {deal.alerts.map((a) => (
              <div key={a.id} style={{ border: "1px solid #333", borderRadius: 8, padding: "0.6rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "center" }}>
                  <strong>{a.title}</strong>
                  <span className="badge">{a.status}</span>
                </div>
                <p style={{ margin: "0.35rem 0 0", color: "var(--text-secondary)", fontSize: "0.88rem" }}>{a.message}</p>
                {a.status === "OPEN" ? (
                  <div style={{ display: "grid", gap: "0.4rem", marginTop: "0.55rem" }}>
                    <form action={clearDealAlertFormAction}>
                      <input type="hidden" name="dealId" value={deal.dealId} />
                      <input type="hidden" name="alertId" value={a.id} />
                      <button type="submit" className="btn btn-secondary">
                        <SubmitLabel idle="Mark as cleared" />
                      </button>
                    </form>
                    <form action={overrideDealAlertFormAction} style={{ display: "grid", gap: "0.35rem" }}>
                      <input type="hidden" name="dealId" value={deal.dealId} />
                      <input type="hidden" name="alertId" value={a.id} />
                      <input
                        name="note"
                        placeholder="Required file note to move forward without clearing"
                        required
                        style={{ width: "100%", padding: "0.45rem", borderRadius: 6, border: "1px solid #333", background: "#111", color: "#eee" }}
                      />
                      <button type="submit" className="btn">
                        <SubmitLabel idle="Override with file note" />
                      </button>
                    </form>
                  </div>
                ) : null}
                {a.resolutionNote ? (
                  <p style={{ margin: "0.45rem 0 0", fontSize: "0.82rem", color: "#fde68a" }}>
                    File note: {a.resolutionNote}
                  </p>
                ) : null}
                <details style={{ marginTop: "0.4rem" }}>
                  <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: "0.82rem" }}>Audit trail</summary>
                  <ul style={{ margin: "0.35rem 0 0", paddingLeft: "1rem", fontSize: "0.8rem", color: "var(--muted)" }}>
                    {a.audits.map((ev) => (
                      <li key={ev.id}>
                        {new Date(ev.createdAt).toLocaleString([], { hour12: false })} · {ev.action}
                        {ev.actorRole ? ` · by ${ev.actorRole}` : ""}
                        {ev.recipientUserId ? ` · to ${ev.recipientUserId}` : ""}
                        {ev.note ? ` · ${ev.note}` : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Step 1 */}
      {deal.status === "DISCLOSURE_REQUIRED" ? (
        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Step 1 · Enter deal details</h2>
          <p style={{ color: "var(--text-secondary)", lineHeight: 1.6, fontSize: "0.92rem" }}>
            Here is what we have on file. If anything is wrong, fix it with your team before you continue.
          </p>
          <ul style={{ margin: "0.75rem 0", paddingLeft: "1.1rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            <li>
              <strong>Buyer:</strong> {deal.buyerDisplay}
            </li>
            <li>
              <strong>Vehicle:</strong> {deal.vehicleDisplay}
            </li>
            <li>
              <strong>Amount financed:</strong> {deal.amountFinancedDisplay}
            </li>
          </ul>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            Upload the signed DealSeal Initial Disclosure to unlock structuring, compliance, and lender submission workflows.
          </p>
          <form action={acknowledgeDisclosureFormAction}>
            <input type="hidden" name="dealId" value={deal.dealId} />
            <input
              name="signerName"
              required
              placeholder="Customer signer name"
              style={{ width: "100%", marginBottom: "0.45rem", padding: "0.45rem", borderRadius: 6, border: "1px solid #333", background: "#111", color: "#eee" }}
            />
            <input
              type="date"
              name="dateSigned"
              required
              style={{ width: "100%", marginBottom: "0.45rem", padding: "0.45rem", borderRadius: 6, border: "1px solid #333", background: "#111", color: "#eee" }}
            />
            <input
              name="dealerRepresentative"
              required
              placeholder="Dealer representative"
              style={{ width: "100%", marginBottom: "0.45rem", padding: "0.45rem", borderRadius: 6, border: "1px solid #333", background: "#111", color: "#eee" }}
            />
            <input
              name="dealershipName"
              required
              placeholder="Dealership legal name"
              style={{ width: "100%", marginBottom: "0.45rem", padding: "0.45rem", borderRadius: 6, border: "1px solid #333", background: "#111", color: "#eee" }}
            />
            <input
              name="stateProfile"
              required
              placeholder="State profile key (example: tx-retail-installment)"
              style={{ width: "100%", marginBottom: "0.45rem", padding: "0.45rem", borderRadius: 6, border: "1px solid #333", background: "#111", color: "#eee" }}
            />
            <input type="file" name="file" required style={{ marginBottom: "0.6rem" }} />
            <button type="submit" className="btn">
              <SubmitLabel idle="Upload signed Initial Disclosure" />
            </button>
          </form>
        </section>
      ) : (
        <section className="card" style={{ marginBottom: "1rem", opacity: 0.92 }}>
          <h2 style={{ marginTop: 0, fontSize: "0.95rem" }}>Deal on file</h2>
          <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-secondary)" }}>
            {deal.buyerDisplay} · {deal.vehicleDisplay} · {deal.amountFinancedDisplay}
          </p>
          <Link href={`/dealer/deals/${deal.dealId}/review`} style={{ fontSize: "0.82rem", marginTop: "0.5rem", display: "inline-block" }}>
            Open detailed review
          </Link>
        </section>
      )}

      {/* Step 2 */}
      {deal.status === "AUTHORIZED_FOR_STRUCTURING" || deal.status === "GREEN_STAGE" ? (
        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Step 2 · Gather unsigned deal jacket docs</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Add insurance and stips. These are collection docs only and can hold estimated pricing before final contract signature.
          </p>
          <form action={generateAiDealJacketDocsFormAction} style={{ display: "grid", gap: "0.45rem", marginTop: "0.65rem" }}>
            <input type="hidden" name="dealId" value={deal.dealId} />
            <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              <input type="checkbox" name="includeBranding" />
              Include dealership name/logo branding in AI-generated docs
            </label>
            <input
              name="logoUrl"
              placeholder="Optional logo URL"
              style={{ width: "100%", padding: "0.45rem", borderRadius: 6, border: "1px solid #333", background: "#111", color: "#eee" }}
            />
            <button type="submit" className="btn btn-secondary">
              <SubmitLabel idle="AI generate required deal-jacket docs" />
            </button>
          </form>
          <form action={uploadGreenStageDocAction} style={{ display: "grid", gap: "0.5rem", marginTop: "0.75rem" }}>
            <input type="hidden" name="dealId" value={deal.dealId} />
            <input type="hidden" name="docType" value="INSURANCE" />
            <label style={{ fontSize: "0.85rem" }}>Insurance</label>
            <input type="file" name="file" required />
            <button type="submit" className="btn btn-secondary">
              <SubmitLabel idle="Upload insurance" />
            </button>
          </form>
          <form action={uploadGreenStageDocAction} style={{ display: "grid", gap: "0.5rem", marginTop: "1rem" }}>
            <input type="hidden" name="dealId" value={deal.dealId} />
            <input type="hidden" name="docType" value="DEALER_UPLOAD" />
            <label style={{ fontSize: "0.85rem" }}>Other stips (title notes, POI, etc.)</label>
            <input type="file" name="file" required />
            <button type="submit" className="btn btn-secondary">
              <SubmitLabel idle="Upload stipulation" />
            </button>
          </form>
          <hr style={{ borderColor: "#333", margin: "1.25rem 0" }} />
          <p style={{ fontWeight: 600, fontSize: "0.95rem" }}>Send to lender for approval</p>
          <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
            Upload your unsigned retail contract. The lender returns the final contract, then AI reconciles all supporting docs to match before signing.
          </p>
          <form action={submitUnsignedRISCAction} style={{ display: "grid", gap: "0.5rem", marginTop: "0.5rem" }}>
            <input type="hidden" name="dealId" value={deal.dealId} />
            <input type="file" name="file" required />
            <button type="submit" className="btn">
              <SubmitLabel idle="Send to lender" />
            </button>
          </form>
        </section>
      ) : null}

      {deal.status === "RISC_UNSIGNED_REVIEW" ? (
        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Step 3 · With your lender</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem" }}>
            Your contract is being reviewed. You will get the printable version here as soon as your lender posts it—check back shortly.
          </p>
        </section>
      ) : null}

      {deal.status === "RISC_LENDER_FINAL" ? (
        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Step 3 · Review final contract, then sign once</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem" }}>
            This is the only contract that should be signed. Supporting jacket documents are aligned by AI to match this governing deal before execution.
          </p>
          {finalRisc?.fileUrl ? (
            <p style={{ marginTop: "0.75rem" }}>
              <a href={finalRisc.fileUrl} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ display: "inline-block" }}>
                Open printable contract
              </a>
            </p>
          ) : (
            <p style={{ color: "var(--muted)" }}>Contract link not available—ask your lender to repost.</p>
          )}
          {!printedExplained ? (
            <button type="button" className="btn" style={{ marginTop: "1rem" }} onClick={() => setPrintedExplained(true)}>
              I printed this and explained it to the buyer
            </button>
          ) : (
            <>
              <h3 style={{ fontSize: "1rem", marginTop: "1.25rem" }}>Step 4 · Upload signed contract</h3>
              <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
                Upload the fully executed governing RISC. This is the signature point that enables first green and package lock.
              </p>
              <form action={uploadSignedRISCAction} style={{ display: "grid", gap: "0.5rem", marginTop: "0.5rem" }}>
                <input type="hidden" name="dealId" value={deal.dealId} />
                <input type="file" name="file" required />
                <button type="submit" className="btn">
                  <SubmitLabel idle="Upload signed contract" />
                </button>
              </form>
            </>
          )}
        </section>
      ) : null}

      {deal.status === "FIRST_GREEN_PASSED" || deal.status === "GENERATING_CLOSING_PACKAGE" ? (
        <section className="card" style={{ borderColor: "#b45309" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Step 5 · AI aligns and validates package</h2>
          <p style={{ fontSize: "0.95rem", fontWeight: 600, color: "#fde68a" }}>
            Governing contract received. AI is aligning all disclosures/deal-jacket docs to match before final package release…
          </p>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>No action needed—this page updates when everything is ready.</p>
          <p style={{ fontSize: "0.8rem", color: "var(--muted)", wordBreak: "break-all" }}>Reference: {hash ?? "—"}</p>
        </section>
      ) : null}

      {deal.status === "AUTHORITATIVE_LOCK" ? (
        <section className="card" style={{ borderColor: "#b45309" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Step 5 · AI aligns and validates package</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem" }}>
            Your signed contract is saved. If the closing package does not appear within a minute, retry below.
          </p>
          <p style={{ fontSize: "0.8rem", color: "var(--muted)", wordBreak: "break-all" }}>Reference: {hash ?? "—"}</p>
          <form action={retryAutopublishFormAction} style={{ marginTop: "0.75rem" }}>
            <input type="hidden" name="dealId" value={deal.dealId} />
            <button type="submit" className="btn btn-secondary">
              <SubmitLabel idle="Retry closing package" />
            </button>
          </form>
        </section>
      ) : null}

      {deal.status === "CLOSING_PACKAGE_READY" || deal.status === "CONSUMMATED" ? (
        <section className="card" style={{ borderColor: "#15803d" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Step 6 · Download closing package</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Everything tied to this deal is packaged and sealed.</p>
          <div
            style={{
              display: "inline-block",
              marginBottom: "0.75rem",
              padding: "0.35rem 0.65rem",
              borderRadius: "6px",
              background: "#14532d",
              color: "#bbf7d0",
              fontSize: "0.78rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
            }}
          >
            SEALED · REF {hashSeal(hash)}
          </div>
          {deal.consummatedSummary ? (
            <div style={{ marginBottom: "1rem", lineHeight: 1.6, fontSize: "0.9rem" }}>
              <p className="ds-card-title">Summary from your signed contract</p>
              <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "var(--text-secondary)" }}>
                <li>Buyer: {deal.consummatedSummary.buyerLabel}</li>
                <li>Financed amount: {deal.consummatedSummary.amountFinanced}</li>
                {deal.consummatedSummary.apr ? <li>{deal.consummatedSummary.apr}</li> : null}
                {deal.consummatedSummary.termMonths ? <li>Term: {deal.consummatedSummary.termMonths}</li> : null}
                {deal.consummatedSummary.payment ? <li>Payment: {deal.consummatedSummary.payment}</li> : null}
              </ul>
            </div>
          ) : null}
          <a className="btn" style={{ display: "inline-block" }} href={`/api/deals/${deal.dealId}/closing-manifest`} target="_blank" rel="noreferrer">
            Download closing package manifest
          </a>
          {deal.status === "CONSUMMATED" ? <p style={{ color: "var(--verified)", marginTop: "0.75rem", fontSize: "0.9rem" }}>This deal is marked complete.</p> : null}
        </section>
      ) : null}

      {deal.status === "FIRST_GREEN_PASSED" || deal.status === "AUTHORITATIVE_LOCK" || deal.status === "CLOSING_PACKAGE_READY" ? (
        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Need to correct a post-signing issue?</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
            Request an amendment for issues like BMV rejection or VIN correction. Your lender must approve it.
          </p>
          <form action={requestAmendmentFormAction} style={{ display: "grid", gap: "0.5rem", marginTop: "0.5rem" }}>
            <input type="hidden" name="dealId" value={deal.dealId} />
            <label style={{ fontSize: "0.85rem" }}>
              Reason
              <select
                name="reason"
                required
                className="btn btn-secondary"
                style={{ marginTop: "0.25rem", width: "100%", textAlign: "left", padding: "0.45rem 0.6rem" }}
              >
                <option value="BMV_REJECTION">BMV Rejection</option>
                <option value="VIN_CORRECTION">VIN Correction</option>
                <option value="FINANCIAL_ADJUSTMENT">Financial Adjustment</option>
              </select>
            </label>
            <label style={{ fontSize: "0.85rem" }}>
              Corrected VIN (optional)
              <input
                name="vin"
                placeholder="Enter corrected VIN if applicable"
                style={{ marginTop: "0.25rem", width: "100%", padding: "0.55rem 0.6rem", borderRadius: 6, border: "1px solid #333", background: "#111", color: "#eee" }}
              />
            </label>
            <button type="submit" className="btn">
              <SubmitLabel idle="Request amendment" />
            </button>
          </form>
          {deal.pendingAmendmentCount > 0 ? (
            <p style={{ marginTop: "0.65rem", color: "var(--muted)", fontSize: "0.82rem" }}>
              Pending lender approvals: {deal.pendingAmendmentCount}
            </p>
          ) : null}
        </section>
      ) : null}

      <details style={{ marginTop: "1.5rem", fontSize: "0.82rem", color: "var(--muted)" }}>
        <summary style={{ cursor: "pointer" }}>File list</summary>
        <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.1rem" }}>
          {deal.documents.length === 0 ? <li>None yet</li> : null}
          {deal.documents.map((d) => (
            <li key={d.id} style={{ marginBottom: "0.25rem" }}>
              {d.documentType ?? "Document"} · v{d.version}
              {d.fileUrl ? (
                <>
                  {" "}
                  <a href={d.fileUrl} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
