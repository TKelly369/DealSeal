import { createHash } from "crypto";

export type RenderingMode = "CERTIFIED" | "NON_AUTHORITATIVE";

export type DemoContractData = {
  buyerName: string;
  dealerName: string;
  vehicle: string;
  vin: string;
  cashPrice: string;
  amountFinanced: string;
  apr: string;
  payment: string;
  term: string;
  signatureSummary: string;
  terms: string[];
};

export type DemoRecord = {
  id: string;
  dealId: string;
  version: number;
  status: "LOCKED";
  lockedAt: string;
  hash: string;
  contractData: DemoContractData;
};

type DemoRecordInput = Omit<DemoRecord, "hash">;

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

export function getRecordHash(record: DemoRecordInput | DemoRecord): string {
  const { hash: _ignored, ...hashable } = record as DemoRecord;
  return sha256Hex(stableStringify(hashable));
}

export function createRenderingHash(record: DemoRecord, mode: RenderingMode, renderedAt: string): string {
  return sha256Hex(`${record.id}:${record.hash}:${mode}:${renderedAt}`);
}

export function buildVerificationUrl(recordId: string, recordHash: string, renderingHash: string): string {
  return `https://dealseal1.com/verify/${encodeURIComponent(recordId)}?hash=${encodeURIComponent(recordHash)}&renderingHash=${encodeURIComponent(renderingHash)}`;
}

const demoRecordInput: DemoRecordInput = {
  id: "demo-record-001",
  dealId: "deal-001",
  version: 1,
  status: "LOCKED",
  lockedAt: "2026-04-25T12:00:00.000Z",
  contractData: {
    buyerName: "Demo Buyer",
    dealerName: "DealSeal Demo Dealer",
    vehicle: "2021 Demo Vehicle",
    vin: "DEMO123456789",
    cashPrice: "$44,000.00",
    amountFinanced: "$49,457.93",
    apr: "8.52%",
    payment: "$879.77",
    term: "72 months",
    signatureSummary: "Electronically signed and locked into authoritative custody.",
    terms: [
      "This record represents the authoritative governing contract data.",
      "Certified renderings are generated from this locked record.",
      "Non-authoritative copies are convenience copies only.",
    ],
  },
};

export const demoRecord: DemoRecord = {
  ...demoRecordInput,
  hash: getRecordHash(demoRecordInput),
};

export const demoRecords: DemoRecord[] = [demoRecord];

export function getDemoRecord(recordId: string): DemoRecord | null {
  return demoRecords.find((record) => record.id === recordId) ?? null;
}
