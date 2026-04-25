import crypto from "crypto";

export type DemoContractData = {
  buyer: {
    legalName: string;
  };
  dealer: {
    name: string;
  };
  vehicle: {
    year: number;
    make: string;
    model: string;
    vin: string;
  };
  financials: {
    cashPrice: string;
    amountFinanced: string;
    apr: string;
    payment: string;
    termMonths: number;
  };
  governingAgreement: {
    title: string;
    referenceCode: string;
  };
  sourceInstrument: {
    documentSha256: string;
  };
  terms: string;
  signatureSummary: string;
};

export type DemoGoverningRecord = {
  id: string;
  dealId: string;
  version: number;
  status: "LOCKED";
  hash: string;
  lockedAt: string;
  createdAt: string;
  custodian: string;
  contractData: DemoContractData;
};

export type DemoGoverningRecordRow = {
  id: string;
  dealId: string;
  version: number;
  status: string;
  hash: string;
  createdAt: string;
  lockedAt: string;
};

const demoContractData: DemoContractData = {
  buyer: {
    legalName: "Jordan Rivera",
  },
  dealer: {
    name: "DealSeal Auto Group",
  },
  vehicle: {
    year: 2024,
    make: "Lexus",
    model: "RX 350",
    vin: "2T2BAMCA7RC000111",
  },
  financials: {
    cashPrice: "48950.00",
    amountFinanced: "42180.00",
    apr: "5.90%",
    payment: "699.82",
    termMonths: 72,
  },
  governingAgreement: {
    title: "Retail Installment Contract",
    referenceCode: "RIC-2026-0001",
  },
  sourceInstrument: {
    documentSha256: "4b5069ee03b27252e0dc026d352f77fdb91f53f6269f5bbf6d3643f52a8b6e64",
  },
  terms:
    "Borrower agrees to repay the amount financed according to scheduled payments. Delinquency, acceleration, and cure rights are governed by the authoritative record maintained in DealSeal custody.",
  signatureSummary: "Buyer and dealer signatures captured under authoritative transaction lock.",
};

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, sortDeep(nested)]);
    return Object.fromEntries(entries);
  }
  return value;
}

function deterministicHash(payload: unknown): string {
  const canonical = JSON.stringify(sortDeep(payload));
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

const demoBase = {
  id: "demo-record-001",
  dealId: "deal-001",
  version: 1,
  status: "LOCKED" as const,
  lockedAt: "2026-04-25T20:00:00.000Z",
  createdAt: "2026-04-25T19:58:00.000Z",
  custodian: "DealSeal Authority Vault",
  contractData: demoContractData,
};

const demoRecordHash = deterministicHash({
  id: demoBase.id,
  dealId: demoBase.dealId,
  version: demoBase.version,
  status: demoBase.status,
  lockedAt: demoBase.lockedAt,
  contractData: demoBase.contractData,
});

export const DEMO_GOVERNING_RECORDS: DemoGoverningRecord[] = [
  {
    ...demoBase,
    hash: demoRecordHash,
  },
];
export const DEMO_GOVERNING_RECORD: DemoGoverningRecord = DEMO_GOVERNING_RECORDS[0];

export const DEMO_GOVERNING_RECORD_ROW: DemoGoverningRecordRow = {
  id: DEMO_GOVERNING_RECORD.id,
  dealId: DEMO_GOVERNING_RECORD.dealId,
  version: DEMO_GOVERNING_RECORD.version,
  status: DEMO_GOVERNING_RECORD.status,
  hash: DEMO_GOVERNING_RECORD.hash,
  createdAt: DEMO_GOVERNING_RECORD.createdAt,
  lockedAt: DEMO_GOVERNING_RECORD.lockedAt,
};

export function getDemoRecordById(recordId: string): DemoGoverningRecord | null {
  return DEMO_GOVERNING_RECORDS.find((record) => record.id === recordId) ?? null;
}

export const demoRecords: DemoGoverningRecord[] = DEMO_GOVERNING_RECORDS;

export function getDemoRecord(recordId: string): DemoGoverningRecord | null {
  return getDemoRecordById(recordId);
}
