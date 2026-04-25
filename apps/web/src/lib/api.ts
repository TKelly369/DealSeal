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
  lockedAt: string | null;
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

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  return fetchJson<DashboardMetrics>("/api/dashboard/metrics");
}

export async function getGoverningRecords(): Promise<GoverningRecordRow[]> {
  return fetchJson<GoverningRecordRow[]>("/api/governing-records");
}
