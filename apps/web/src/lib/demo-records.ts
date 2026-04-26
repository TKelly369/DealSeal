export interface GoverningRecord {
  id: string;
  title: string;
  body: string;
  parties: string;
  effectiveAt: string;
  version: number;
}

export const DEMO_RECORDS: GoverningRecord[] = [
  {
    id: "demo-record-001",
    title: "Vehicle Retail Installment Contract",
    body: "This Vehicle Retail Installment Contract is entered into between the parties listed below. The buyer agrees to purchase the vehicle described herein subject to the terms and conditions set forth in this contract. All representations, warranties, and obligations are derived from and subordinate to this Authoritative Governing Record as maintained in the DealSeal platform.",
    parties: "ABC Motors Inc., John Doe",
    effectiveAt: "2026-04-25",
    version: 1,
  },
];

export function getDemoRecordById(recordId: string): GoverningRecord | undefined {
  return DEMO_RECORDS.find((record) => record.id === recordId);
}
