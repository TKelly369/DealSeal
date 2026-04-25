"use client";

import type { DemoRecord } from "@/lib/demo-records";

type ContractViewerProps = {
  record: DemoRecord;
  mode?: "BASE" | "CERTIFIED" | "NON_AUTHORITATIVE";
  renderingHash?: string;
  verificationUrl?: string;
  renderedAt?: string;
};

const CERTIFICATION_STATEMENT =
  "This document is a Certified Visual Rendering generated from the Authoritative Governing Record maintained in DealSeal. The authoritative record remains in system custody. This rendering is verifiable via Record ID and hash.";

const NON_AUTH_DISCLAIMER =
  "This is a non-authoritative convenience copy. It does not independently establish control, ownership, or enforceability.";

export function ContractViewer({
  record,
  mode = "BASE",
  renderingHash,
  verificationUrl,
  renderedAt,
}: ContractViewerProps) {
  const showCertified = mode === "CERTIFIED";
  const showNonAuthoritative = mode === "NON_AUTHORITATIVE";
  const renderedTimestamp = renderedAt ?? record.lockedAt;

  return (
    <section className="ds-contract-viewer">
      <article className="ds-contract-paper">
        {showCertified ? <div className="ds-contract-watermark">CERTIFIED RENDERING</div> : null}

        {showCertified ? (
          <div className="ds-contract-overlay ds-contract-overlay--certified">
            <h3>Certification Banner</h3>
            <dl>
              <div>
                <dt>Record ID</dt>
                <dd>{record.id}</dd>
              </div>
              <div>
                <dt>Version</dt>
                <dd>{record.version}</dd>
              </div>
              <div>
                <dt>Record Hash</dt>
                <dd className="ds-mono">{record.hash}</dd>
              </div>
              <div>
                <dt>Rendering Hash</dt>
                <dd className="ds-mono">{renderingHash ?? "Pending"}</dd>
              </div>
              <div>
                <dt>Timestamp</dt>
                <dd>{new Date(renderedTimestamp).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Verification URL</dt>
                <dd className="ds-mono">{verificationUrl ?? "Pending"}</dd>
              </div>
            </dl>
            <p>{CERTIFICATION_STATEMENT}</p>
          </div>
        ) : null}

        {showNonAuthoritative ? (
          <div className="ds-contract-overlay ds-contract-overlay--non-authoritative">
            <p>{NON_AUTH_DISCLAIMER}</p>
          </div>
        ) : null}

        <header className="ds-contract-header">
          <h2>Retail Installment Contract</h2>
          <p>DealSeal authoritative facsimile</p>
        </header>

        <section className="ds-contract-grid">
          <div>
            <h4>Buyer</h4>
            <p>{record.contractData.buyerName}</p>
          </div>
          <div>
            <h4>Dealer</h4>
            <p>{record.contractData.dealerName}</p>
          </div>
          <div>
            <h4>Vehicle</h4>
            <p>
              {record.contractData.vehicle} ({record.contractData.vin})
            </p>
          </div>
          <div>
            <h4>Cash Price</h4>
            <p>{record.contractData.cashPrice}</p>
          </div>
          <div>
            <h4>Amount Financed</h4>
            <p>{record.contractData.amountFinanced}</p>
          </div>
          <div>
            <h4>APR / Payment / Term</h4>
            <p>
              {record.contractData.apr} · {record.contractData.payment} · {record.contractData.term}
            </p>
          </div>
        </section>

        <section className="ds-contract-section">
          <h4>Terms</h4>
          <p>{record.contractData.terms}</p>
        </section>

        <section className="ds-contract-section">
          <h4>Signature Summary</h4>
          <p>{record.contractData.signatureSummary}</p>
        </section>
      </article>
    </section>
  );
}
