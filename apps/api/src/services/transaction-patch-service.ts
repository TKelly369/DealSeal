import type { Prisma, TransactionState } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { assertNoActiveHold, canPatchDealData } from "./hold-service.js";
import { recordAudit } from "./audit-service.js";
import { runFullRuleReevaluation } from "./rules-revaluation-service.js";
import { applyMaterialStateDemotion } from "./transaction-material-state.js";
import {
  classifyBuyerMaterial,
  classifyFinancialMaterial,
  classifyVehicleMaterial,
  diffJsonObject,
  type BuyerSnapshot,
  type FinancialSnapshot,
  type VehicleSnapshot,
} from "./transaction-material-classifier.js";

export type PatchMeta = {
  expectedVersion?: number;
  reason?: string;
  ip?: string;
  userAgent?: string;
};

async function loadTxOrThrow(orgId: string, transactionId: string) {
  const tx = await prisma.transaction.findFirst({
    where: { id: transactionId, orgId },
    include: { buyer: true, vehicle: true, financials: true },
  });
  if (!tx) throw new HttpError(404, "Transaction not found", "NOT_FOUND");
  if (!canPatchDealData(tx.state)) {
    throw new HttpError(423, "Transaction state forbids data edits", "STATE_BLOCKED");
  }
  await assertNoActiveHold({ orgId, transactionId });
  return tx;
}

function assertOptimisticVersion(
  current: number | undefined,
  expected: number | undefined,
): void {
  if (expected === undefined) return;
  if (current === undefined || current !== expected) {
    throw new HttpError(409, "Version conflict — resource changed", "VERSION_CONFLICT", {
      currentVersion: current ?? null,
      expectedVersion: expected,
    });
  }
}

export async function patchBuyerProfile(input: {
  orgId: string;
  transactionId: string;
  actorUserId: string;
  patch: {
    legalName?: string;
    dob?: Date | null;
    addressJson?: Prisma.InputJsonValue;
    identifiersJson?: Prisma.InputJsonValue;
  };
  meta: PatchMeta;
}): Promise<{
  buyerProfileId: string;
  version: number;
  materialChange: boolean;
  stateDemoted: boolean;
}> {
  const tx = await loadTxOrThrow(input.orgId, input.transactionId);
  const prev = tx.buyer;
  assertOptimisticVersion(prev?.version, input.meta.expectedVersion);

  const beforeSnap: BuyerSnapshot | null = prev
    ? {
        legalName: prev.legalName,
        dob: prev.dob,
        addressJson: prev.addressJson,
        identifiersJson: prev.identifiersJson,
      }
    : null;

  const merged: BuyerSnapshot = {
    legalName: input.patch.legalName ?? prev?.legalName ?? "Unknown",
    dob: input.patch.dob !== undefined ? input.patch.dob : prev?.dob ?? null,
    addressJson: (input.patch.addressJson ??
      prev?.addressJson ??
      {}) as Prisma.InputJsonValue,
    identifiersJson: (input.patch.identifiersJson ??
      prev?.identifiersJson ??
      {}) as Prisma.InputJsonValue,
  };

  const material = classifyBuyerMaterial(beforeSnap, merged);
  const diffParts: Record<string, unknown> = {};
  if (beforeSnap) {
    if (beforeSnap.legalName !== merged.legalName) {
      diffParts.legalName = { from: beforeSnap.legalName, to: merged.legalName };
    }
    if ((beforeSnap.dob?.getTime() ?? null) !== (merged.dob?.getTime() ?? null)) {
      diffParts.dob = { from: beforeSnap.dob, to: merged.dob };
    }
    if (JSON.stringify(beforeSnap.addressJson) !== JSON.stringify(merged.addressJson)) {
      diffParts.addressJson = diffJsonObject(
        beforeSnap.addressJson as Record<string, unknown>,
        merged.addressJson as Record<string, unknown>,
      );
    }
    if (
      JSON.stringify(beforeSnap.identifiersJson) !==
      JSON.stringify(merged.identifiersJson)
    ) {
      diffParts.identifiersJson = diffJsonObject(
        beforeSnap.identifiersJson as Record<string, unknown>,
        merged.identifiersJson as Record<string, unknown>,
      );
    }
  } else {
    diffParts.initial = true;
  }

  const sourceState = tx.state;

  const result = await prisma.$transaction(async (db) => {
    let demoted = false;
    if (material) {
      const newState = await applyMaterialStateDemotion(db, {
        transactionId: input.transactionId,
        fromState: sourceState,
        actorUserId: input.actorUserId,
        reason:
          input.meta.reason ??
          "Material buyer change requires re-validation",
      });
      demoted = newState !== null;
    }

    let profile = await db.buyerProfile.findUnique({
      where: { transactionId: input.transactionId },
    });
    const fromVersion = profile?.version ?? null;
    const nextVersion = profile ? profile.version + 1 : 1;

    if (!profile) {
      profile = await db.buyerProfile.create({
        data: {
          transactionId: input.transactionId,
          legalName: merged.legalName,
          dob: merged.dob,
          addressJson: merged.addressJson as Prisma.InputJsonValue,
          identifiersJson: merged.identifiersJson as Prisma.InputJsonValue,
          version: nextVersion,
        },
      });
    } else {
      profile = await db.buyerProfile.update({
        where: { id: profile.id },
        data: {
          legalName: merged.legalName,
          dob: merged.dob,
          addressJson: merged.addressJson as Prisma.InputJsonValue,
          identifiersJson: merged.identifiersJson as Prisma.InputJsonValue,
          version: nextVersion,
        },
      });
    }

    await db.buyerProfileVersion.create({
      data: {
        buyerProfileId: profile.id,
        transactionId: input.transactionId,
        version: nextVersion,
        legalName: profile.legalName,
        dob: profile.dob,
        addressJson: profile.addressJson as Prisma.InputJsonValue,
        identifiersJson: profile.identifiersJson as Prisma.InputJsonValue,
        fromVersion,
        sourceState,
        materialChange: material,
        changeReason: input.meta.reason ?? null,
        diffJson: diffParts as Prisma.InputJsonValue,
        editorUserId: input.actorUserId,
      },
    });

    return {
      buyerProfileId: profile.id,
      version: nextVersion,
      materialChange: material,
      stateDemoted: demoted,
    };
  });

  await recordAudit({
    orgId: input.orgId,
    transactionId: input.transactionId,
    actorUserId: input.actorUserId,
    eventType: "BUYER_PROFILE_PATCH",
    action: "BUYER_PROFILE_PATCH",
    entityType: "BuyerProfile",
    entityId: result.buyerProfileId,
    resource: "BuyerProfile",
    resourceId: result.buyerProfileId,
    payload: {
      version: result.version,
      materialChange: result.materialChange,
      stateDemoted: result.stateDemoted,
      sourceState,
      diff: diffParts,
      patch: input.patch,
    } as Prisma.InputJsonValue,
    ip: input.meta.ip,
    userAgent: input.meta.userAgent,
  });

  await runFullRuleReevaluation({
    transactionId: input.transactionId,
    orgId: input.orgId,
  });

  return result;
}

export async function patchVehicleRecord(input: {
  orgId: string;
  transactionId: string;
  actorUserId: string;
  patch: {
    vin?: string | null;
    year?: number | null;
    make?: string | null;
    model?: string | null;
    trim?: string | null;
    mileage?: number | null;
    rawJson?: Prisma.InputJsonValue;
  };
  meta: PatchMeta;
}): Promise<{
  vehicleRecordId: string;
  version: number;
  materialChange: boolean;
  stateDemoted: boolean;
}> {
  const tx = await loadTxOrThrow(input.orgId, input.transactionId);
  const prev = tx.vehicle;
  assertOptimisticVersion(prev?.version, input.meta.expectedVersion);

  const beforeSnap: VehicleSnapshot | null = prev
    ? {
        vin: prev.vin,
        year: prev.year,
        make: prev.make,
        model: prev.model,
        trim: prev.trim,
        mileage: prev.mileage,
        rawJson: prev.rawJson,
      }
    : null;

  const merged: VehicleSnapshot = {
    vin: input.patch.vin !== undefined ? input.patch.vin : prev?.vin ?? null,
    year: input.patch.year !== undefined ? input.patch.year : prev?.year ?? null,
    make: input.patch.make !== undefined ? input.patch.make : prev?.make ?? null,
    model: input.patch.model !== undefined ? input.patch.model : prev?.model ?? null,
    trim: input.patch.trim !== undefined ? input.patch.trim : prev?.trim ?? null,
    mileage:
      input.patch.mileage !== undefined ? input.patch.mileage : prev?.mileage ?? null,
    rawJson: (input.patch.rawJson ?? prev?.rawJson ?? {}) as Prisma.InputJsonValue,
  };

  const material = classifyVehicleMaterial(beforeSnap, merged);
  const diffParts: Record<string, unknown> = {};
  if (beforeSnap) {
    const keys = [
      "vin",
      "year",
      "make",
      "model",
      "trim",
      "mileage",
      "rawJson",
    ] as const;
    for (const k of keys) {
      const a = beforeSnap[k];
      const b = merged[k];
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        diffParts[k] = { from: a, to: b };
      }
    }
  } else {
    diffParts.initial = true;
  }

  const sourceState = tx.state;

  const result = await prisma.$transaction(async (db) => {
    let demoted = false;
    if (material) {
      const newState = await applyMaterialStateDemotion(db, {
        transactionId: input.transactionId,
        fromState: sourceState,
        actorUserId: input.actorUserId,
        reason:
          input.meta.reason ??
          "Material vehicle change requires re-validation",
      });
      demoted = newState !== null;
    }

    let record = await db.vehicleRecord.findUnique({
      where: { transactionId: input.transactionId },
    });
    const fromVersion = record?.version ?? null;
    const nextVersion = record ? record.version + 1 : 1;

    if (!record) {
      record = await db.vehicleRecord.create({
        data: {
          transactionId: input.transactionId,
          vin: merged.vin,
          year: merged.year,
          make: merged.make,
          model: merged.model,
          trim: merged.trim,
          mileage: merged.mileage,
          rawJson: merged.rawJson as Prisma.InputJsonValue,
          version: nextVersion,
        },
      });
    } else {
      record = await db.vehicleRecord.update({
        where: { id: record.id },
        data: {
          vin: merged.vin,
          year: merged.year,
          make: merged.make,
          model: merged.model,
          trim: merged.trim,
          mileage: merged.mileage,
          rawJson: merged.rawJson as Prisma.InputJsonValue,
          version: nextVersion,
        },
      });
    }

    await db.vehicleRecordVersion.create({
      data: {
        vehicleRecordId: record.id,
        transactionId: input.transactionId,
        version: nextVersion,
        vin: record.vin,
        year: record.year,
        make: record.make,
        model: record.model,
        trim: record.trim,
        mileage: record.mileage,
        rawJson: record.rawJson as Prisma.InputJsonValue,
        fromVersion,
        sourceState,
        materialChange: material,
        changeReason: input.meta.reason ?? null,
        diffJson: diffParts as Prisma.InputJsonValue,
        editorUserId: input.actorUserId,
      },
    });

    return {
      vehicleRecordId: record.id,
      version: nextVersion,
      materialChange: material,
      stateDemoted: demoted,
    };
  });

  await recordAudit({
    orgId: input.orgId,
    transactionId: input.transactionId,
    actorUserId: input.actorUserId,
    eventType: "VEHICLE_RECORD_PATCH",
    action: "VEHICLE_RECORD_PATCH",
    entityType: "VehicleRecord",
    entityId: result.vehicleRecordId,
    resource: "VehicleRecord",
    resourceId: result.vehicleRecordId,
    payload: {
      version: result.version,
      materialChange: result.materialChange,
      stateDemoted: result.stateDemoted,
      sourceState,
      diff: diffParts,
      patch: input.patch,
    } as Prisma.InputJsonValue,
    ip: input.meta.ip,
    userAgent: input.meta.userAgent,
  });

  await runFullRuleReevaluation({
    transactionId: input.transactionId,
    orgId: input.orgId,
  });

  return result;
}

export async function patchDealFinancials(input: {
  orgId: string;
  transactionId: string;
  actorUserId: string;
  patch: {
    amountFinanced?: number;
    aprBps?: number | null;
    termMonths?: number | null;
    paymentJson?: Prisma.InputJsonValue;
    lenderCode?: string | null;
  };
  meta: PatchMeta;
}): Promise<{
  dealFinancialsId: string;
  version: number;
  materialChange: boolean;
  stateDemoted: boolean;
}> {
  const tx = await loadTxOrThrow(input.orgId, input.transactionId);
  const prev = tx.financials;
  assertOptimisticVersion(prev?.version, input.meta.expectedVersion);

  const amount =
    input.patch.amountFinanced ??
    (prev?.amountFinanced
      ? Number(prev.amountFinanced as unknown as string)
      : null);
  if (amount === null || Number.isNaN(amount)) {
    throw new HttpError(400, "amountFinanced required on first write", "VALIDATION");
  }

  const beforeSnap: FinancialSnapshot | null = prev
    ? {
        amountFinanced: Number(prev.amountFinanced as unknown as string),
        aprBps: prev.aprBps,
        termMonths: prev.termMonths,
        paymentJson: prev.paymentJson,
        lenderCode: prev.lenderCode,
      }
    : null;

  const merged: FinancialSnapshot = {
    amountFinanced: amount,
    aprBps:
      input.patch.aprBps !== undefined ? input.patch.aprBps : prev?.aprBps ?? null,
    termMonths:
      input.patch.termMonths !== undefined
        ? input.patch.termMonths
        : prev?.termMonths ?? null,
    paymentJson: (input.patch.paymentJson ??
      prev?.paymentJson ??
      {}) as Prisma.InputJsonValue,
    lenderCode:
      input.patch.lenderCode !== undefined
        ? input.patch.lenderCode
        : prev?.lenderCode ?? null,
  };

  const material = classifyFinancialMaterial(beforeSnap, merged);
  const diffParts: Record<string, unknown> = {};
  if (beforeSnap) {
    for (const k of [
      "amountFinanced",
      "aprBps",
      "termMonths",
      "lenderCode",
      "paymentJson",
    ] as const) {
      const a = beforeSnap[k];
      const b = merged[k];
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        diffParts[k] = { from: a, to: b };
      }
    }
  } else {
    diffParts.initial = true;
  }

  const sourceState = tx.state;

  const result = await prisma.$transaction(async (db) => {
    let demoted = false;
    if (material) {
      const newState = await applyMaterialStateDemotion(db, {
        transactionId: input.transactionId,
        fromState: sourceState,
        actorUserId: input.actorUserId,
        reason:
          input.meta.reason ??
          "Material financial change requires re-validation",
      });
      demoted = newState !== null;
    }

    let row = await db.dealFinancials.findUnique({
      where: { transactionId: input.transactionId },
    });
    const fromVersion = row?.version ?? null;
    const nextVersion = row ? row.version + 1 : 1;

    if (!row) {
      row = await db.dealFinancials.create({
        data: {
          transactionId: input.transactionId,
          amountFinanced: merged.amountFinanced,
          aprBps: merged.aprBps,
          termMonths: merged.termMonths,
          paymentJson: merged.paymentJson as Prisma.InputJsonValue,
          lenderCode: merged.lenderCode,
          version: nextVersion,
        },
      });
    } else {
      row = await db.dealFinancials.update({
        where: { id: row.id },
        data: {
          amountFinanced: merged.amountFinanced,
          aprBps: merged.aprBps,
          termMonths: merged.termMonths,
          paymentJson: merged.paymentJson as Prisma.InputJsonValue,
          lenderCode: merged.lenderCode,
          version: nextVersion,
        },
      });
    }

    await db.dealFinancialsVersion.create({
      data: {
        dealFinancialsId: row.id,
        transactionId: input.transactionId,
        version: nextVersion,
        amountFinanced: row.amountFinanced,
        aprBps: row.aprBps,
        termMonths: row.termMonths,
        paymentJson: row.paymentJson as Prisma.InputJsonValue,
        lenderCode: row.lenderCode,
        fromVersion,
        sourceState,
        materialChange: material,
        changeReason: input.meta.reason ?? null,
        diffJson: diffParts as Prisma.InputJsonValue,
        editorUserId: input.actorUserId,
      },
    });

    return {
      dealFinancialsId: row.id,
      version: nextVersion,
      materialChange: material,
      stateDemoted: demoted,
    };
  });

  await recordAudit({
    orgId: input.orgId,
    transactionId: input.transactionId,
    actorUserId: input.actorUserId,
    eventType: "DEAL_FINANCIALS_PATCH",
    action: "DEAL_FINANCIALS_PATCH",
    entityType: "DealFinancials",
    entityId: result.dealFinancialsId,
    resource: "DealFinancials",
    resourceId: result.dealFinancialsId,
    payload: {
      version: result.version,
      materialChange: result.materialChange,
      stateDemoted: result.stateDemoted,
      sourceState,
      diff: diffParts,
      patch: input.patch,
    } as Prisma.InputJsonValue,
    ip: input.meta.ip,
    userAgent: input.meta.userAgent,
  });

  await runFullRuleReevaluation({
    transactionId: input.transactionId,
    orgId: input.orgId,
  });

  return result;
}
