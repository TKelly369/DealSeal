import { getServerApiBaseUrl } from "./config";

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
  return fetchJson<DashboardMetrics>("/api/dashboard/metrics");
}

export async function getGoverningRecords(): Promise<GoverningRecordRow[]> {
  return fetchJson<GoverningRecordRow[]>("/api/governing-records");
}

export async function getRecords(): Promise<GoverningRecordRow[]> {
  return fetchJson<GoverningRecordRow[]>("/api/governing-records");
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

export async function getRecord(recordId: string): Promise<RecordDetails> {
  return fetchNoStoreJson<RecordDetails>(`/api/governing-records/${encodeURIComponent(recordId)}`);
}

export type VerifyRecordResponse = {
  valid: boolean;
  hashMatch: boolean;
  version: number;
  timestamp: string;
  recordId?: string;
  recordHash?: string;
};

export async function verifyRecord(recordId: string): Promise<VerifyRecordResponse> {
  return fetchNoStoreJson<VerifyRecordResponse>(`/verify/${encodeURIComponent(recordId)}`);
}

export type RenderContractResponse = {
  renderingEventId: string;
  renderingHashSha256: string;
  recordHashAtRender: string;
  pdfBase64: string;
  mode: RenderMode;
};

export async function renderContract(
  recordId: string,
  mode: RenderMode,
  token: string,
): Promise<RenderContractResponse> {
  const base = getServerApiBaseUrl();
  const response = await fetch(`${base}/governing-records/${encodeURIComponent(recordId)}/render`, {
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
    throw new Error(message || `Render failed (${response.status})`);
  }
  return (await response.json()) as RenderContractResponse;
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
