import type { Prisma } from "@prisma/client";

export type BuyerSnapshot = {
  legalName: string;
  dob: Date | null;
  addressJson: unknown;
  identifiersJson: unknown;
};

export type VehicleSnapshot = {
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  mileage: number | null;
  rawJson: unknown;
};

export type FinancialSnapshot = {
  amountFinanced: number;
  aprBps: number | null;
  termMonths: number | null;
  paymentJson: unknown;
  lenderCode: string | null;
};

function jsonChanged(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
}

/**
 * MATERIAL buyer change: identity / compliance fields (name, DOB, government IDs).
 * NON-MATERIAL: address-only or cosmetic label tweaks in addressJson without identity impact.
 */
export function classifyBuyerMaterial(
  before: BuyerSnapshot | null,
  after: BuyerSnapshot,
): boolean {
  if (!before) return true;
  if (before.legalName !== after.legalName) return true;
  const dobA = before.dob?.getTime() ?? null;
  const dobB = after.dob?.getTime() ?? null;
  if (dobA !== dobB) return true;
  if (jsonChanged(before.identifiersJson, after.identifiersJson)) return true;
  if (jsonChanged(before.addressJson, after.addressJson)) return false;
  return false;
}

/**
 * MATERIAL vehicle change: VIN, model year, make, model (title-relevant).
 * NON-MATERIAL: trim, mileage, free-form rawJson notes.
 */
export function classifyVehicleMaterial(
  before: VehicleSnapshot | null,
  after: VehicleSnapshot,
): boolean {
  if (!before) return true;
  if ((before.vin ?? "") !== (after.vin ?? "")) return true;
  if (before.year !== after.year) return true;
  if ((before.make ?? "") !== (after.make ?? "")) return true;
  if ((before.model ?? "") !== (after.model ?? "")) return true;
  return false;
}

/**
 * MATERIAL financial change: financed amount, lender, term, APR, or payment structure.
 */
export function classifyFinancialMaterial(
  before: FinancialSnapshot | null,
  after: FinancialSnapshot,
): boolean {
  if (!before) return true;
  if (before.amountFinanced !== after.amountFinanced) return true;
  if (before.lenderCode !== after.lenderCode) return true;
  if (before.termMonths !== after.termMonths) return true;
  if (before.aprBps !== after.aprBps) return true;
  if (jsonChanged(before.paymentJson, after.paymentJson)) return true;
  return false;
}

export function diffJsonObject(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
): Prisma.InputJsonValue {
  const out: Record<string, { from?: unknown; to?: unknown }> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after)]);
  for (const k of keys) {
    const fv = before?.[k];
    const tv = after[k];
    if (JSON.stringify(fv) !== JSON.stringify(tv)) {
      out[k] = { from: fv, to: tv };
    }
  }
  return out as Prisma.InputJsonValue;
}
