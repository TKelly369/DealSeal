import { createHash } from "crypto";

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
  terms: string;
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

export function getRecordHash(record: Omit<DemoRecord, "hash"> | DemoRecord): string {
  const { hash: _existingHash, ...payload } = record as DemoRecord;
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export function buildVerificationUrl(recordId: string, recordHash: string, renderingHash: string): string {
  return `https://dealseal1.com/verify/${encodeURIComponent(recordId)}?hash=${encodeURIComponent(recordHash)}&renderingHash=${encodeURIComponent(renderingHash)}`;
}

const baseRecord: Omit<DemoRecord, "hash"> = {
  id: "demo-record-001",
  dealId: "deal-001",
  version: 1,
  status: "LOCKED",
  lockedAt: "2026-04-25T20:00:00.000Z",
  contractData: {
    buyerName: "Jordan Rivera",
    dealerName: "DealSeal Auto Group",
    vehicle: "2024 Lexus RX 350",
    vin: "2T2BAMCA7RC000111",
    cashPrice: "$48,950.00",
    amountFinanced: "$42,180.00",
    apr: "5.90%",
    payment: "$699.82",
    term: "72 months",
    signatureSummary: "Buyer and dealer signatures captured under authoritative transaction lock.",
    terms:
      "Borrower agrees to repay the amount financed according to scheduled payments. Delinquency, acceleration, and cure rights are governed by the authoritative record maintained in DealSeal custody.",
  },
};

export const demoRecord: DemoRecord = {
  ...baseRecord,
  hash: getRecordHash(baseRecord),
};

export function getDemoRecord(recordId: string): DemoRecord | null {
  if (recordId === demoRecord.id) {
    return demoRecord;
  }
  return null;
}
