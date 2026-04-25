import type { GoverningRecord } from "@prisma/client";
import { canonicalStringify, baseTemplateBodyHash } from "../lib/record-hashing.js";

/**
 * Single source for certified and convenience PDFs. Only overlay layers differ.
 */
export const KIND_BASE = "Deal-Scan.ContractBaseTemplate" as const;
const HTML_OVERLAY_SLOT = "<!-- DEALSEAL_OVERLAY_SLOT -->";

export type BaseContractViewModel = {
  kind: typeof KIND_BASE;
  version: 1;
  recordId: string;
  publicRef: string;
  governVersion: number;
  title: string;
  sections: { heading: string; body: string }[];
};

const CERT_TEXT =
  "This document is a Certified Visual Rendering generated from the Authoritative Governing Record maintained in Deal-Scan. The authoritative record remains in system custody. This rendering is verifiable via Record ID and hash.";

const CONV_TEXT =
  "This is a non-authoritative convenience copy. It does not independently establish control, ownership, or enforceability.";

export function getCertifiedAttestationText(): string {
  return CERT_TEXT;
}

export function getConvenienceDisclaimerText(): string {
  return CONV_TEXT;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatLabel(key: string): string {
  return key
    .replaceAll("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function stringifyValue(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return JSON.stringify(value);
}

function flattenObjectRows(input: unknown, prefix = ""): Array<{ label: string; value: string }> {
  if (Array.isArray(input)) {
    return input.flatMap((item, index) => flattenObjectRows(item, `${prefix}[${index}]`));
  }

  if (!isRecord(input)) {
    return [{ label: prefix || "Value", value: stringifyValue(input) }];
  }

  const entries = Object.entries(input);
  if (entries.length === 0) {
    return [{ label: prefix || "Value", value: "{}" }];
  }

  return entries.flatMap(([key, value]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (isRecord(value) || Array.isArray(value)) {
      return flattenObjectRows(value, nextPrefix);
    }
    return [{ label: nextPrefix, value: stringifyValue(value) }];
  });
}

function getContractPayload(record: GoverningRecord): unknown {
  if (isRecord(record.contractData) && Object.keys(record.contractData).length > 0) {
    return record.contractData;
  }
  return record.recordDataJson;
}

export function buildBaseContractHTML(record: GoverningRecord): string {
  const payload = getContractPayload(record);
  const payloadEntries = isRecord(payload)
    ? Object.entries(payload)
    : [["contractPayload", payload] as const];

  const sectionsHtml = payloadEntries
    .map(([sectionKey, sectionValue]) => {
      const rows = flattenObjectRows(sectionValue)
        .map(
          (row) => `
            <tr>
              <th>${escapeHtml(formatLabel(row.label))}</th>
              <td>${escapeHtml(row.value)}</td>
            </tr>
          `,
        )
        .join("");

      return `
        <section class="contract-section">
          <h3>${escapeHtml(formatLabel(sectionKey))}</h3>
          <table class="contract-table">
            <tbody>
              ${rows}
            </tbody>
          </table>
        </section>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Deal-Scan Contract Rendering</title>
    <style>
      :root {
        color-scheme: dark;
        --ds-bg: #050505;
        --ds-surface: #111111;
        --ds-surface-soft: #181818;
        --ds-text: #ffffff;
        --ds-text-muted: #b8bcc2;
        --ds-accent: #c8102e;
        --ds-border: #2a2a2a;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--ds-bg);
        color: var(--ds-text);
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.45;
      }
      .contract-page {
        max-width: 980px;
        margin: 28px auto;
        padding: 32px;
        background: var(--ds-surface);
        border: 1px solid var(--ds-border);
        border-radius: 12px;
        box-shadow: 0 14px 30px rgba(0, 0, 0, 0.35);
      }
      .contract-heading {
        margin: 0 0 12px;
        font-size: 28px;
        letter-spacing: -0.02em;
        color: var(--ds-text);
      }
      .contract-subheading {
        margin: 0;
        color: var(--ds-text-muted);
        font-size: 14px;
      }
      .contract-meta {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px 24px;
        margin: 20px 0 24px;
        padding: 16px;
        border: 1px solid var(--ds-border);
        border-radius: 10px;
        background: var(--ds-surface-soft);
      }
      .contract-meta dt {
        font-size: 12px;
        color: var(--ds-text-muted);
      }
      .contract-meta dd {
        margin: 2px 0 0;
        font-size: 13px;
        color: var(--ds-text);
        word-break: break-all;
      }
      .contract-section + .contract-section {
        margin-top: 20px;
      }
      .contract-section h3 {
        margin: 0 0 10px;
        font-size: 16px;
        color: var(--ds-text);
      }
      .contract-table {
        width: 100%;
        border-collapse: collapse;
      }
      .contract-table th,
      .contract-table td {
        padding: 9px 10px;
        border: 1px solid var(--ds-border);
        vertical-align: top;
      }
      .contract-table th {
        width: 40%;
        text-align: left;
        font-size: 12px;
        color: var(--ds-text-muted);
        background: #151515;
      }
      .contract-table td {
        font-size: 13px;
        color: var(--ds-text);
      }
      .overlay-panel {
        margin-top: 28px;
        padding: 18px;
        border-radius: 10px;
        border: 1px solid var(--ds-border);
        background: var(--ds-surface-soft);
      }
      .overlay-panel h4 {
        margin: 0 0 8px;
        font-size: 16px;
        color: var(--ds-text);
      }
      .overlay-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px 20px;
        margin: 12px 0 0;
      }
      .overlay-grid p {
        margin: 0;
        font-size: 13px;
        color: var(--ds-text-muted);
        word-break: break-all;
      }
      .overlay-note {
        margin-top: 14px;
        font-size: 13px;
        color: var(--ds-text-muted);
      }
      .overlay-certified {
        border-left: 4px solid var(--ds-accent);
      }
      .overlay-certified h4 {
        color: #ffd8de;
      }
      .overlay-convenience {
        border-left: 4px solid #6b7280;
      }
      .overlay-convenience h4 {
        color: #d1d5db;
      }
      .overlay-key {
        color: var(--ds-text-muted);
      }
      .overlay-value {
        color: var(--ds-text);
      }
      .overlay-highlight {
        color: #ffd8de;
      }
    </style>
  </head>
  <body>
    <main class="contract-page">
      <h1 class="contract-heading">Authoritative Contract Rendering</h1>
      <p class="contract-subheading">
        Structured facsimile generated from the Deal-Scan governing record.
      </p>

      <dl class="contract-meta">
        <div>
          <dt>Governing Record ID</dt>
          <dd>${escapeHtml(record.id)}</dd>
        </div>
        <div>
          <dt>Deal ID</dt>
          <dd>${escapeHtml(record.dealId || record.transactionId)}</dd>
        </div>
        <div>
          <dt>Version</dt>
          <dd>${escapeHtml(String(record.version))}</dd>
        </div>
        <div>
          <dt>Custodian</dt>
          <dd>${escapeHtml(record.custodian)}</dd>
        </div>
      </dl>

      ${sectionsHtml}

      ${HTML_OVERLAY_SLOT}
    </main>
  </body>
</html>
`.trim();
}

export function injectOverlayIntoBaseContractHTML(baseHtml: string, overlayHtml: string): string {
  if (baseHtml.includes(HTML_OVERLAY_SLOT)) {
    return baseHtml.replace(HTML_OVERLAY_SLOT, overlayHtml);
  }
  return `${baseHtml}\n${overlayHtml}`;
}

/**
 * Map governing record JSON to the one shared base template the renderer uses (certified and convenience).
 */
export function buildBaseViewModelFromGoverningRecord(gr: GoverningRecord): BaseContractViewModel {
  const payload = getContractPayload(gr);
  const data = (isRecord(payload) ? payload : {}) as {
    governingAgreement?: { title?: string; referenceCode?: string } | null;
    transaction?: { publicId?: string; state?: string } | null;
    buyer?: { legalName?: string } | null;
    vehicle?: { year?: number | null; make?: string | null; model?: string | null; vin?: string | null } | null;
    financials?: { amountFinanced?: string } | null;
    sourceInstrument?: { documentSha256?: string } | null;
  };
  const title = data.governingAgreement?.title ?? "Retail Installment Contract";
  const sections: BaseContractViewModel["sections"] = [
    { heading: "Reference", body: `Public deal ID: ${data.transaction?.publicId ?? "—"}\nGoverning ref: ${data.governingAgreement?.referenceCode ?? "—"}\nState: ${data.transaction?.state ?? "—"}` },
    { heading: "Buyer", body: data.buyer?.legalName ? `Name: ${data.buyer.legalName}` : "Name: (not on record)" },
  ];
  if (data.vehicle) {
    sections.push({
      heading: "Vehicle",
      body: [data.vehicle.year, data.vehicle.make, data.vehicle.model].filter(Boolean).join(" ") + (data.vehicle.vin ? `\nVIN: ${data.vehicle.vin}` : ""),
    });
  }
  if (data.financials?.amountFinanced) {
    sections.push({ heading: "Amount financed", body: data.financials.amountFinanced });
  }
  if (data.sourceInstrument?.documentSha256) {
    sections.push({ heading: "Source instrument (SHA-256)", body: data.sourceInstrument.documentSha256 });
  }
  return {
    kind: KIND_BASE,
    version: 1,
    recordId: gr.id,
    publicRef: gr.publicRef,
    governVersion: gr.version,
    title,
    sections,
  };
}

export function baseViewModelContentHash(model: BaseContractViewModel): string {
  return baseTemplateBodyHash(model);
}

/** For tests: two modes must serialize to the same string before any overlay. */
export function assertSameBaseModel(a: BaseContractViewModel, b: BaseContractViewModel): void {
  const sa = canonicalStringify(a);
  const sb = canonicalStringify(b);
  if (sa !== sb) {
    throw new Error("Base contract template mismatch between render modes (must be identical before overlays).");
  }
}

export { canonicalStringify };
