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

const NON_AUTHORITATIVE_DISCLAIMER =
  "This is a non-authoritative convenience copy. It does not independently establish control, ownership, or enforceability.";

export function ContractViewer({
  record,
  mode = "BASE",
  renderingHash,
  verificationUrl,
  renderedAt,
}: ContractViewerProps) {
  const isCertified = mode === "CERTIFIED";
  const isNonAuthoritative = mode === "NON_AUTHORITATIVE";
  const renderTimestamp = renderedAt ?? record.lockedAt;

  return (
    <section className="ds-contract-viewer">
      <article className="ds-contract-paper">
        {isCertified ? <div className="ds-contract-watermark">CERTIFIED RENDERING</div> : null}

        {isCertified ? (
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
                <dd>{new Date(renderTimestamp).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Verification URL</dt>
                <dd className="ds-mono">{verificationUrl ?? "Pending"}</dd>
              </div>
            </dl>
            <p>{CERTIFICATION_STATEMENT}</p>
          </div>
        ) : null}

        {isNonAuthoritative ? (
          <div className="ds-contract-overlay ds-contract-overlay--non-authoritative">
            <p>{NON_AUTHORITATIVE_DISCLAIMER}</p>
          </div>
        ) : null}

        <header className="ds-contract-header">
          <h2>Contract Header</h2>
          <p>Authoritative Governing Record Facsimile</p>
        </header>

        <section className="ds-contract-grid">
          <div>
            <h4>Parties</h4>
            <p>
              Buyer: {record.contractData.buyerName}
              <br />
              Dealer: {record.contractData.dealerName}
            </p>
          </div>
          <div>
            <h4>Vehicle</h4>
            <p>
              {record.contractData.vehicle}
              <br />
              VIN: {record.contractData.vin}
            </p>
          </div>
          <div>
            <h4>Financial Terms</h4>
            <p>
              Cash Price: {record.contractData.cashPrice}
              <br />
              Amount Financed: {record.contractData.amountFinanced}
              <br />
              APR: {record.contractData.apr}
              <br />
              Payment: {record.contractData.payment}
              <br />
              Term: {record.contractData.term}
            </p>
          </div>
          <div>
            <h4>Terms</h4>
            <ul className="ds-contract-terms">
              {record.contractData.terms.map((term) => (
                <li key={term}>{term}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="ds-contract-section">
          <h4>Signature Summary</h4>
          <p>{record.contractData.signatureSummary}</p>
        </section>
      </article>
    </section>
  );
}
