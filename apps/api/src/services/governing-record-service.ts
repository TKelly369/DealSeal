import { Prisma, RecordStatus, TransactionState } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { recordHashFromPayload } from "../lib/record-hashing.js";
import { GoverningAuditEventKind, appendGoverningRecordAudit } from "./governing-record-audit.js";
import { ExecutedContractVerificationState } from "@prisma/client";
import { recordAudit } from "./audit-service.js";

const RECORD_KIND = "Deal-Scan.AuthoritativeGoverningRecord" as const;

/**
 * Snapshot structure hashed into `GoverningRecord` — also used to rebuild the single base contract template.
 */
export function buildRecordPayloadFromTransaction(tx: {
  id: string;
  publicId: string;
  orgId: string;
  state: string;
  governingAgreement: { id: string; referenceCode: string; title: string; candidateVersion: number; executedVersion: number | null; lockedAt: Date | null } | null;
  buyer: { legalName: string; version: number } | null;
  vehicle: { vin: string | null; year: number | null; make: string | null; model: string | null; version: number } | null;
  financials: { amountFinanced: { toString(): string }; version: number } | null;
  executedContracts: Array<{
    id: string;
    sha256: string;
    documentVersionId: string | null;
    lockedAt: Date | null;
  }>;
}): {
  kind: typeof RECORD_KIND;
  version: 1;
  createdAt: string;
  transaction: { id: string; publicId: string; orgId: string; state: string };
  governingAgreement: typeof tx.governingAgreement;
  sourceInstrument: { executedContractId: string; documentSha256: string; documentVersionId: string | null; lockedAt: string | null } | null;
  buyer: typeof tx.buyer;
  vehicle: { vin: string | null; year: number | null; make: string | null; model: string | null; version: number } | null;
  financials: { amountFinanced: string; version: number } | null;
} {
  const ec = tx.executedContracts[0];
  const financials = tx.financials
    ? { amountFinanced: tx.financials.amountFinanced.toString(), version: tx.financials.version }
    : null;
  return {
    kind: RECORD_KIND,
    version: 1,
    createdAt: new Date().toISOString(),
    transaction: { id: tx.id, publicId: tx.publicId, orgId: tx.orgId, state: tx.state },
    governingAgreement: tx.governingAgreement
      ? {
          id: tx.governingAgreement.id,
          referenceCode: tx.governingAgreement.referenceCode,
          title: tx.governingAgreement.title,
          candidateVersion: tx.governingAgreement.candidateVersion,
          executedVersion: tx.governingAgreement.executedVersion,
          lockedAt: tx.governingAgreement.lockedAt,
        }
      : null,
    sourceInstrument: ec
      ? {
          executedContractId: ec.id,
          documentSha256: ec.sha256,
          documentVersionId: ec.documentVersionId,
          lockedAt: ec.lockedAt?.toISOString() ?? null,
        }
      : null,
    buyer: tx.buyer ? { legalName: tx.buyer.legalName, version: tx.buyer.version } : null,
    vehicle: tx.vehicle
      ? {
          vin: tx.vehicle.vin,
          year: tx.vehicle.year,
          make: tx.vehicle.make,
          model: tx.vehicle.model,
          version: tx.vehicle.version,
        }
      : null,
    financials,
  };
}

/**
 * After lock: create or update the single governing record for the transaction, mark LOCKED, and hash.
 */
export async function upsertGoverningRecordOnLock(input: { orgId: string; transactionId: string; actorUserId: string }): Promise<void> {
  const tx = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
    include: {
      governingAgreement: true,
      buyer: true,
      vehicle: true,
      financials: true,
      executedContracts: {
        where: { verificationStatus: ExecutedContractVerificationState.VERIFIED },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!tx) return;
  const payload = buildRecordPayloadFromTransaction(tx);
  const hash = recordHashFromPayload(payload);
  const now = new Date();
  const line = { at: now.toISOString(), kind: "LOCK", by: input.actorUserId, note: "Transaction locked" };

  const existing = await prisma.governingRecord.findFirst({ where: { transactionId: tx.id } });
  if (existing) {
    await prisma.$transaction(async (db) => {
      const upd = await db.governingRecord.update({
        where: { id: existing.id },
        data: {
          version: { increment: 1 },
          status: RecordStatus.LOCKED,
          recordDataJson: payload as unknown as Prisma.InputJsonValue,
          recordHashSha256: hash,
          controlAssignmentJson: { custody: "Deal-Scan", organizationId: tx.orgId } as Prisma.InputJsonValue,
          lockedAt: now,
          versionAuditJson: [...(Array.isArray(existing.versionAuditJson) ? (existing.versionAuditJson as unknown[]) : []), line] as Prisma.InputJsonValue,
        },
      });
      await appendGoverningRecordAudit({
        governingRecordId: upd.id,
        eventKind: GoverningAuditEventKind.RECORD_LOCKED,
        message: "Governing record sealed at lock",
        actorUserId: input.actorUserId,
      });
    });
    await recordAudit({
      orgId: input.orgId,
      transactionId: tx.id,
      actorUserId: input.actorUserId,
      eventType: "GOVERNING_RECORD",
      action: "LOCK",
      entityType: "GoverningRecord",
      entityId: existing.id,
      resource: "GoverningRecord",
      resourceId: existing.id,
      payload: { recordHashSha256: hash, version: existing.version + 1 },
    });
    return;
  }

  const gr = await prisma.governingRecord.create({
    data: {
      dealId: tx.publicId,
      contractData: payload as unknown as Prisma.InputJsonValue,
      hash,
      custodian: "Deal-Scan",
      orgId: tx.orgId,
      transactionId: tx.id,
      version: 1,
      status: RecordStatus.LOCKED,
      recordDataJson: payload as unknown as Prisma.InputJsonValue,
      signaturesJson: {} as Prisma.InputJsonValue,
      controlAssignmentJson: { custody: "Deal-Scan", organizationId: tx.orgId } as Prisma.InputJsonValue,
      versionAuditJson: [line] as Prisma.InputJsonValue,
      recordHashSha256: hash,
    },
  });
  await appendGoverningRecordAudit({
    governingRecordId: gr.id,
    eventKind: GoverningAuditEventKind.RECORD_CREATED,
    message: "Governing record materialized on lock",
    actorUserId: input.actorUserId,
  });
  await appendGoverningRecordAudit({
    governingRecordId: gr.id,
    eventKind: GoverningAuditEventKind.RECORD_LOCKED,
    message: "Governing record locked",
    actorUserId: input.actorUserId,
  });
  await recordAudit({
    orgId: input.orgId,
    transactionId: tx.id,
    actorUserId: input.actorUserId,
    eventType: "GOVERNING_RECORD",
    action: "CREATE",
    entityType: "GoverningRecord",
    entityId: gr.id,
    resource: "GoverningRecord",
    resourceId: gr.id,
    payload: { recordHashSha256: hash, version: 1 },
  });
}

export async function syncGoverningRecordSealedStorageKey(input: { orgId: string; transactionId: string; sealedStorageKey: string }): Promise<void> {
  const gr = await prisma.governingRecord.findFirst({
    where: { transaction: { id: input.transactionId, orgId: input.orgId } },
  });
  if (!gr) return;
  await prisma.governingRecord.update({
    where: { id: gr.id },
    data: { sealedStorageKey: input.sealedStorageKey },
  });
}

export function assertRecordHashMatchesRow(gr: { recordDataJson: unknown; recordHashSha256: string }): boolean {
  return recordHashFromPayload(gr.recordDataJson) === gr.recordHashSha256;
}

export function verifyRecordMessage(gr: { recordDataJson: unknown; recordHashSha256: string }): {
  recordVerifies: boolean;
  computedHash: string;
} {
  const computed = recordHashFromPayload(gr.recordDataJson);
  return { recordVerifies: computed === gr.recordHashSha256, computedHash: computed };
}

/**
 * Backfill: create a LOCKED GoverningRecord for a transaction that is LOCKED but has no row yet.
 * Returns whether a row was created, skipped, or the operation errored.
 */
export async function backfillSingleGoverningRecordForTransaction(transactionId: string): Promise<{
  status: "created" | "skipped" | "error";
  message: string;
  governingRecordId?: string;
}> {
  const has = await prisma.governingRecord.findFirst({ where: { transactionId } });
  if (has) {
    return { status: "skipped", message: "GoverningRecord already exists", governingRecordId: has.id };
  }
  const tx = await prisma.transaction.findFirst({
    where: { id: transactionId, state: TransactionState.LOCKED },
    include: {
      governingAgreement: true,
      buyer: true,
      vehicle: true,
      financials: true,
      executedContracts: {
        where: { verificationStatus: ExecutedContractVerificationState.VERIFIED },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!tx) {
    return { status: "skipped", message: "Transaction not found or not LOCKED" };
  }
  if (!tx.governingAgreement) {
    return { status: "error", message: "Missing GoverningAgreement; cannot build governing record" };
  }
  const payload = buildRecordPayloadFromTransaction(tx);
  const hash = recordHashFromPayload(payload);
  const line = { at: new Date().toISOString(), kind: "BACKFILL", note: "One-off GoverningRecord backfill" };
  const lockedAt =
    tx.governingAgreement.lockedAt ?? tx.executedContracts[0]?.lockedAt ?? tx.governingAgreement.updatedAt;
  const executedAt = tx.executedContracts[0]?.lockedAt ?? null;
  try {
    const gr = await prisma.governingRecord.create({
      data: {
        dealId: tx.publicId,
        contractData: payload as unknown as Prisma.InputJsonValue,
        hash,
        custodian: "Deal-Scan",
        orgId: tx.orgId,
        transactionId: tx.id,
        version: 1,
        status: RecordStatus.LOCKED,
        recordDataJson: payload as unknown as Prisma.InputJsonValue,
        signaturesJson: {} as Prisma.InputJsonValue,
        controlAssignmentJson: { custody: "Deal-Scan", organizationId: tx.orgId, backfill: true } as Prisma.InputJsonValue,
        versionAuditJson: [line] as Prisma.InputJsonValue,
        recordHashSha256: hash,
        lockedAt,
        executedAt,
      },
    });
    await appendGoverningRecordAudit({
      governingRecordId: gr.id,
      eventKind: GoverningAuditEventKind.RECORD_BACKFILL,
      message: "Backfill created GoverningRecord for pre-feature LOCKED deal",
      actorUserId: null,
    });
    return { status: "created", message: "Created", governingRecordId: gr.id };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
