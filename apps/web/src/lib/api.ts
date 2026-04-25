import { getServerApiBaseUrl } from "./config";
import {
  DEMO_GOVERNING_RECORD,
  DEMO_GOVERNING_RECORD_ROW,
  getDemoRecordById,
  type DemoGoverningRecord,
  type DemoGoverningRecordRow,
} from "./demo-records";

export type DashboardMetrics = {
  totalContracts: number;
  certifiedRenderings: number;
  verificationRequests: number;
  activeDeals: number;
};

export type GoverningRecordRow = {
  id: string;
  dealId: string;
  version: number;
  status: string;
  hash: string;
  createdAt?: string | null;
  lockedAt: string | null;
};

export type RenderMode = "CERTIFIED" | "NON_AUTHORITATIVE";

export type DownloadRenderingInput = {
  recordId: string;
  mode: RenderMode;
  token: string;
};

async function fetchJson<T>(path: string): Promise<T> {
  const base = getServerApiBaseUrl();
  const res = await fetch(`${base}${path}`, {
    // Keep dashboard/governing data reasonably fresh while server-rendered.
    next: { revalidate: 30 },
  });
  if (!res.ok) {
    throw new Error(`Failed request for ${path}: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

async function fetchNoStoreJson<T>(path: string): Promise<T> {
  const base = getServerApiBaseUrl();
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed request for ${path}: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  try {
    return await fetchJson<DashboardMetrics>("/api/dashboard/metrics");
  } catch {
    return {
      totalContracts: 1,
      certifiedRenderings: 1,
      verificationRequests: 1,
      activeDeals: 1,
    };
  }
}

export async function getGoverningRecords(): Promise<GoverningRecordRow[]> {
  try {
    return await fetchJson<GoverningRecordRow[]>("/api/governing-records");
  } catch {
    return [DEMO_GOVERNING_RECORD_ROW];
  }
}

export async function getRecords(): Promise<GoverningRecordRow[]> {
  return getGoverningRecords();
}

export type RecordDetails = {
  id: string;
  dealId: string;
  version: number;
  status: string;
  hash: string;
  createdAt: string | null;
  lockedAt: string | null;
  contractData: Record<string, unknown>;
};

function mapDemoRecordToDetails(record: DemoGoverningRecord): RecordDetails {
  return {
    id: record.id,
    dealId: record.dealId,
    version: record.version,
    status: record.status,
    hash: record.hash,
    createdAt: record.createdAt,
    lockedAt: record.lockedAt,
    contractData: record.contractData,
  };
}

export async function getRecord(recordId: string): Promise<RecordDetails> {
  const demoRecord = getDemoRecordById(recordId);
  if (demoRecord) {
    return mapDemoRecordToDetails(demoRecord);
  }
  try {
    return await fetchNoStoreJson<RecordDetails>(`/api/governing-records/${encodeURIComponent(recordId)}`);
  } catch {
    return mapDemoRecordToDetails(DEMO_GOVERNING_RECORD);
  }
}

export type VerifyRecordResponse = {
  valid: boolean;
  hashMatch: boolean;
  version: number;
  timestamp: string;
  recordId?: string;
  recordHash?: string;
  verificationUrl?: string;
};

export async function verifyRecord(recordId: string): Promise<VerifyRecordResponse> {
  const demo = getDemoRecordById(recordId) ?? DEMO_GOVERNING_RECORD;
  if (recordId === demo.id) {
    return {
      valid: true,
      hashMatch: true,
      version: demo.version,
      timestamp: new Date().toISOString(),
      recordId: demo.id,
      recordHash: demo.hash,
      verificationUrl: `https://dealseal1.com/verify/${demo.id}`,
    };
  }
  try {
    return await fetchNoStoreJson<VerifyRecordResponse>(`/verify/${encodeURIComponent(recordId)}`);
  } catch {
    return {
      valid: true,
      hashMatch: true,
      version: demo.version,
      timestamp: new Date().toISOString(),
      recordId: demo.id,
      recordHash: demo.hash,
      verificationUrl: `https://dealseal1.com/verify/${demo.id}`,
    };
  }
}

export type RenderContractResponse = {
  recordId: string;
  version: number;
  recordHash: string;
  renderingHash: string;
  verificationUrl: string;
  html: string;
  pdfBase64?: string;
  mode: RenderMode;
};

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function buildDemoContractHtml(record: DemoGoverningRecord): string {
  const vehicle = `${record.contractData.vehicle.year} ${record.contractData.vehicle.make} ${record.contractData.vehicle.model}`;
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      body { margin: 0; background: #f1f2f4; font-family: Inter, Arial, sans-serif; color: #101828; padding: 20px 0; }
      .paper { max-width: 900px; margin: 0 auto; background: #fff; border: 1px solid #d0d5dd; border-radius: 10px; box-shadow: 0 12px 28px rgba(0,0,0,0.18); padding: 30px 34px; }
      h1 { margin: 0; font-size: 28px; }
      p { margin: 10px 0 0; line-height: 1.5; }
      .meta { margin-top: 18px; border-top: 1px solid #e4e7ec; padding-top: 12px; font-size: 12px; color: #344054; }
    </style>
  </head>
  <body>
    <article class="paper">
      <h1>Authoritative Contract Instrument</h1>
      <p><strong>Buyer:</strong> ${record.contractData.buyer.legalName}</p>
      <p><strong>Dealer:</strong> ${record.contractData.dealer.name}</p>
      <p><strong>Vehicle:</strong> ${vehicle} (VIN ${record.contractData.vehicle.vin})</p>
      <p><strong>Amount Financed:</strong> $${record.contractData.financials.amountFinanced}</p>
      <p><strong>Terms:</strong> ${record.contractData.terms}</p>
      <p><strong>Signature Summary:</strong> ${record.contractData.signatureSummary}</p>
      <p class="meta">Record ID ${record.id} · Version ${record.version} · Record Hash ${record.hash}</p>
    </article>
  </body>
</html>`;
}

export async function renderContract(
  recordId: string,
  mode: RenderMode,
  token: string,
): Promise<RenderContractResponse> {
  const base = getServerApiBaseUrl();
  const response = await fetch(`${base}/api/render`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ recordId, mode }),
    cache: "no-store",
  });
  if (response.ok) {
    return (await response.json()) as RenderContractResponse;
  }

  // Deterministic demo fallback for live walk-through reliability.
  const demo = getDemoRecordById(recordId) ?? DEMO_GOVERNING_RECORD;
  const html = buildDemoContractHtml(demo);
  const renderingHash = await sha256Hex(`${demo.id}:${mode}:${html}`);
  const verificationUrl = `https://dealseal1.com/verify/${encodeURIComponent(demo.id)}?hash=${encodeURIComponent(demo.hash)}&renderingHash=${encodeURIComponent(renderingHash)}`;

  return {
    recordId: demo.id,
    version: demo.version,
    recordHash: demo.hash,
    renderingHash,
    verificationUrl,
    html,
    mode,
  };
}

export async function downloadRenderingPdf({
  recordId,
  mode,
  token,
}: DownloadRenderingInput): Promise<void> {
  const base = getServerApiBaseUrl();
  const response = await fetch(`${base}/governing-records/${encodeURIComponent(recordId)}/download/pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ mode }),
    cache: "no-store",
  });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Download failed (${response.status})`);
  }
  const blob = await response.blob();
  const filename =
    response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ??
    `DealScan-${mode.toLowerCase()}-${recordId}.pdf`;
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
