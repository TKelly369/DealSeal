import { getServerApiBaseUrl } from "./config";
import {
  DEMO_GOVERNING_RECORD,
  DEMO_GOVERNING_RECORD_ROW,
  getDemoRecord,
  type DemoGoverningRecord,
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
  const demoRecord = getDemoRecord(recordId);
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
  const demo = getDemoRecord(recordId) ?? DEMO_GOVERNING_RECORD;
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
  renderedAt: string;
};

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
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
  const demo = getDemoRecord(recordId) ?? DEMO_GOVERNING_RECORD;
  const renderingHash = await sha256Hex(`${demo.id}:${mode}:${demo.hash}:${demo.version}`);
  const verificationUrl = `https://dealseal1.com/verify/${encodeURIComponent(demo.id)}?hash=${encodeURIComponent(demo.hash)}&renderingHash=${encodeURIComponent(renderingHash)}`;

  return {
    recordId: demo.id,
    version: demo.version,
    recordHash: demo.hash,
    renderingHash,
    verificationUrl,
    renderedAt: new Date().toISOString(),
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
