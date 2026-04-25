"use client";

import { useEffect, useMemo, useState } from "react";

type ViewerMode = "BASE" | "CERTIFIED" | "NON_AUTHORITATIVE";

type ContractViewerProps = {
  recordId: string;
  recordHash: string;
  version: number;
  contractData: Record<string, unknown>;
  timestamp?: string | null;
  renderedHtml?: string | null;
  renderedMode?: Exclude<ViewerMode, "BASE"> | null;
  renderingHash?: string | null;
  verificationUrl?: string | null;
};

type ContractSections = {
  buyer: string;
  dealer: string;
  vehicle: string;
  price: string;
  terms: string;
  signatureSummary: string;
};

const CERTIFICATION_TEXT =
  "This document is a Certified Visual Rendering generated from the Authoritative Governing Record maintained in Deal-Scan. The authoritative record remains in system custody. This rendering is verifiable via Record ID and hash.";

const NON_AUTHORITATIVE_TEXT =
  "This is a non-authoritative convenience copy. It does not independently establish control, ownership, or enforceability.";

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function formatCurrency(value: string | null): string {
  if (!value) {
    return "Not disclosed";
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(parsed);
}

function extractSections(contractData: Record<string, unknown>): ContractSections {
  const buyer = isRecord(contractData.buyer) ? contractData.buyer : {};
  const dealer = isRecord(contractData.dealer) ? contractData.dealer : {};
  const vehicle = isRecord(contractData.vehicle) ? contractData.vehicle : {};
  const financials = isRecord(contractData.financials) ? contractData.financials : {};
  const governingAgreement = isRecord(contractData.governingAgreement) ? contractData.governingAgreement : {};
  const sourceInstrument = isRecord(contractData.sourceInstrument) ? contractData.sourceInstrument : {};
  const transaction = isRecord(contractData.transaction) ? contractData.transaction : {};

  const buyerName = readString(buyer, "legalName") ?? "Not specified";
  const dealerName =
    readString(dealer, "name") ??
    readString(transaction, "orgId") ??
    "Dealership of record maintained in system custody";

  const vehicleDescriptor = [
    typeof vehicle.year === "number" ? String(vehicle.year) : null,
    readString(vehicle, "make"),
    readString(vehicle, "model"),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
  const vehicleVin = readString(vehicle, "vin");
  const vehicleSummary =
    vehicleDescriptor.length > 0
      ? vehicleVin
        ? `${vehicleDescriptor} (VIN ${vehicleVin})`
        : vehicleDescriptor
      : "Vehicle details are not present on this governing record.";

  const amountFinanced = readString(financials, "amountFinanced");
  const priceSummary = formatCurrency(amountFinanced);

  const termMonths =
    typeof financials.termMonths === "number" ? `${financials.termMonths} months` : "Term not specified";
  const agreementTitle = readString(governingAgreement, "title") ?? "Retail Installment Contract";
  const referenceCode = readString(governingAgreement, "referenceCode") ?? "No reference code";
  const termsSummary = `${agreementTitle} · Ref ${referenceCode} · ${termMonths}`;

  const sourceHash = readString(sourceInstrument, "documentSha256");
  const sourceLabel = sourceHash
    ? `Source instrument hash: ${sourceHash}`
    : "No source instrument digest available.";

  return {
    buyer: buyerName,
    dealer: dealerName,
    vehicle: vehicleSummary,
    price: priceSummary,
    terms: termsSummary,
    signatureSummary: sourceLabel,
  };
}

function buildPaperHtml(input: {
  mode: ViewerMode;
  recordId: string;
  recordHash: string;
  version: number;
  timestamp: string;
  renderingHash?: string | null;
  verificationUrl?: string | null;
  sections: ContractSections;
}): string {
  const isCertified = input.mode === "CERTIFIED";
  const isCopy = input.mode === "NON_AUTHORITATIVE";

  const renderingHashText = input.renderingHash ?? "pending";
  const verifyUrlText = input.verificationUrl ?? "https://dealseal1.com/verify";

  const certifiedBanner = isCertified
    ? `
      <div class="overlay-banner">
        <div><span>Record ID</span><strong>${escapeHtml(input.recordId)}</strong></div>
        <div><span>Version</span><strong>${escapeHtml(String(input.version))}</strong></div>
        <div><span>Record Hash</span><strong>${escapeHtml(input.recordHash)}</strong></div>
        <div><span>Rendering Hash</span><strong>${escapeHtml(renderingHashText)}</strong></div>
        <div><span>Timestamp</span><strong>${escapeHtml(input.timestamp)}</strong></div>
        <div><span>Verification URL</span><strong>${escapeHtml(verifyUrlText)}</strong></div>
      </div>
    `
    : "";

  const certifiedWatermark = isCertified
    ? `<div class="watermark">CERTIFIED RENDERING</div>`
    : "";

  const attestation = isCertified
    ? `
      <div class="attestation">
        <p>${escapeHtml(CERTIFICATION_TEXT)}</p>
        <p><strong>Verification URL:</strong> ${escapeHtml(verifyUrlText)}</p>
      </div>
    `
    : isCopy
      ? `<div class="disclaimer">${escapeHtml(NON_AUTHORITATIVE_TEXT)}</div>`
      : "";

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        margin: 0;
        background: #f1f2f4;
        font-family: "Inter", "Segoe UI", Arial, sans-serif;
        color: #0f172a;
        padding: 26px 0;
      }
      .paper {
        width: 900px;
        margin: 0 auto;
        background: #ffffff;
        border-radius: 12px;
        border: 1px solid #d1d5db;
        box-shadow: 0 10px 34px rgba(12, 16, 28, 0.2);
        overflow: hidden;
        position: relative;
      }
      .paper-inner {
        padding: 34px 44px 42px;
        position: relative;
      }
      .header {
        border-bottom: 1px solid #dbe0e8;
        padding-bottom: 16px;
        margin-bottom: 24px;
      }
      .title {
        margin: 0;
        font-size: 28px;
        font-weight: 700;
        letter-spacing: -0.01em;
      }
      .subtitle {
        margin: 8px 0 0;
        font-size: 13px;
        color: #475467;
      }
      .overlay-banner {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        border: 1px solid #d8a8af;
        border-radius: 10px;
        background: #fff4f6;
        padding: 12px 14px;
        margin-bottom: 20px;
      }
      .overlay-banner span {
        display: block;
        font-size: 11px;
        color: #6b7280;
      }
      .overlay-banner strong {
        display: block;
        margin-top: 4px;
        font-size: 12px;
        color: #111827;
        word-break: break-word;
      }
      .watermark {
        position: absolute;
        top: 48%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-24deg);
        font-size: 100px;
        letter-spacing: 0.08em;
        color: rgba(200, 16, 46, 0.08);
        font-weight: 800;
        pointer-events: none;
        user-select: none;
      }
      .section {
        margin-bottom: 18px;
      }
      .section h3 {
        margin: 0 0 10px;
        font-size: 14px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: #667085;
      }
      .section p {
        margin: 0;
        font-size: 15px;
        line-height: 1.55;
      }
      .terms {
        border-top: 1px solid #e5e7eb;
        border-bottom: 1px solid #e5e7eb;
        padding: 16px 0;
      }
      .signature-row {
        margin-top: 20px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 22px;
      }
      .signature-cell {
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 14px;
      }
      .signature-label {
        margin: 0 0 24px;
        color: #6b7280;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .signature-line {
        border-top: 1px solid #9ca3af;
        margin-top: 12px;
      }
      .signature-meta {
        margin: 10px 0 0;
        font-size: 12px;
        color: #4b5563;
      }
      .attestation {
        margin-top: 20px;
        padding: 14px 16px;
        border: 1px solid #f0bcc6;
        border-left: 4px solid #c8102e;
        border-radius: 8px;
        background: #fff4f6;
        color: #2d1020;
        font-size: 13px;
        line-height: 1.5;
      }
      .attestation p {
        margin: 0;
      }
      .attestation p + p {
        margin-top: 8px;
      }
      .disclaimer {
        margin-top: 24px;
        padding: 14px 16px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        color: #334155;
        font-size: 13px;
        background: #f8fafc;
      }
      .record-meta {
        margin-top: 18px;
        display: flex;
        gap: 12px;
        font-size: 12px;
        color: #6b7280;
      }
      .record-meta strong {
        color: #111827;
      }
    </style>
  </head>
  <body>
    <article class="paper">
      ${certifiedWatermark}
      <div class="paper-inner">
        ${certifiedBanner}
        <header class="header">
          <h1 class="title">Authoritative Contract Instrument</h1>
          <p class="subtitle">DealSeal system-rendered contract facsimile (Version ${escapeHtml(String(input.version))})</p>
        </header>

        <section class="section">
          <h3>Buyer</h3>
          <p>${escapeHtml(input.sections.buyer)}</p>
        </section>
        <section class="section">
          <h3>Dealer</h3>
          <p>${escapeHtml(input.sections.dealer)}</p>
        </section>
        <section class="section">
          <h3>Vehicle</h3>
          <p>${escapeHtml(input.sections.vehicle)}</p>
        </section>
        <section class="section">
          <h3>Price</h3>
          <p>${escapeHtml(input.sections.price)}</p>
        </section>
        <section class="section terms">
          <h3>Terms</h3>
          <p>${escapeHtml(input.sections.terms)}</p>
        </section>
        <section class="section">
          <h3>Signature Summary</h3>
          <p>${escapeHtml(input.sections.signatureSummary)}</p>
        </section>

        <div class="signature-row">
          <div class="signature-cell">
            <p class="signature-label">Buyer Signature</p>
            <div class="signature-line"></div>
            <p class="signature-meta">Signed through governing record controls</p>
          </div>
          <div class="signature-cell">
            <p class="signature-label">Dealer Signature</p>
            <div class="signature-line"></div>
            <p class="signature-meta">Certified by transaction authority workflow</p>
          </div>
        </div>

        ${attestation}

        <div class="record-meta">
          <span>Record ID: <strong>${escapeHtml(input.recordId)}</strong></span>
          <span>Hash: <strong>${escapeHtml(input.recordHash.slice(0, 16))}…</strong></span>
        </div>
      </div>
    </article>
  </body>
</html>
`;
}

export function ContractViewer({
  recordId,
  recordHash,
  version,
  contractData,
  timestamp,
  renderedHtml,
  renderedMode,
  renderingHash,
  verificationUrl,
}: ContractViewerProps) {
  const [mode, setMode] = useState<ViewerMode>(renderedMode ?? "BASE");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (renderedMode) {
      setMode(renderedMode);
      setLoading(true);
    }
  }, [renderedMode]);

  const sections = useMemo(() => extractSections(contractData), [contractData]);
  const issuedAt = timestamp ?? new Date().toISOString();
  const srcDoc = useMemo(
    () => {
      if (renderedHtml && renderedMode && mode === renderedMode) {
        return renderedHtml;
      }
      return buildPaperHtml({
        mode,
        recordId,
        recordHash,
        version,
        timestamp: issuedAt,
        renderingHash,
        verificationUrl,
        sections,
      });
    },
    [mode, recordId, recordHash, version, issuedAt, renderingHash, verificationUrl, sections, renderedHtml, renderedMode],
  );

  return (
    <section className="contract-viewer">
      <div className="contract-viewer__toolbar">
        <p className="contract-viewer__label">Viewer Mode</p>
        <div className="contract-viewer__toggle">
          <button
            type="button"
            className={mode === "BASE" ? "contract-viewer__toggle-btn is-active" : "contract-viewer__toggle-btn"}
            onClick={() => {
              setLoading(true);
              setMode("BASE");
            }}
          >
            Base
          </button>
          <button
            type="button"
            className={mode === "CERTIFIED" ? "contract-viewer__toggle-btn is-active" : "contract-viewer__toggle-btn"}
            onClick={() => {
              setLoading(true);
              setMode("CERTIFIED");
            }}
          >
            Certified
          </button>
          <button
            type="button"
            className={
              mode === "NON_AUTHORITATIVE" ? "contract-viewer__toggle-btn is-active" : "contract-viewer__toggle-btn"
            }
            onClick={() => {
              setLoading(true);
              setMode("NON_AUTHORITATIVE");
            }}
          >
            Non-Authoritative
          </button>
        </div>
      </div>
      {renderedHtml && renderedMode && mode === renderedMode ? (
        <div className="contract-viewer__result-meta">
          <p>
            Rendering hash: <span className="ds-table__mono">{renderingHash ?? "—"}</span>
          </p>
          <p>
            Verification URL:{" "}
            {verificationUrl ? (
              <a href={verificationUrl} target="_blank" rel="noreferrer">
                {verificationUrl}
              </a>
            ) : (
              "—"
            )}
          </p>
        </div>
      ) : null}
      <div className="contract-viewer__frame-wrap">
        {loading ? <p className="contract-viewer__loading">Loading contract viewer...</p> : null}
        <iframe
          title="Contract Viewer"
          className="contract-viewer__frame"
          srcDoc={srcDoc}
          onLoad={() => setLoading(false)}
        />
      </div>
    </section>
  );
}
