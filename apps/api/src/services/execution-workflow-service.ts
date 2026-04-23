import {
  type Prisma,
  ExecutedContractVerificationState,
  ExecutionVerificationResult,
  DocumentIngestStatus,
  DocumentType,
  TransactionState,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { recordAudit } from "./audit-service.js";
import { transitionTransaction } from "./state-engine.js";
import type { UserRole } from "@prisma/client";

const PRE_EXECUTION_STATES: Set<TransactionState> = new Set([
  "GREEN_STAGE_1",
  "APPROVED",
  "EXECUTED_PENDING_VERIFICATION",
]);

function assertPreExecutionState(state: TransactionState) {
  if (!PRE_EXECUTION_STATES.has(state)) {
    throw new HttpError(409, "Transaction is not in a pre-execution state", "STATE", {
      state,
    });
  }
}

export async function submitExecutedSourceInstrument(input: {
  orgId: string;
  transactionId: string;
  actorUserId: string;
  documentId: string;
  documentVersionId?: string;
  roles: UserRole[];
}): Promise<{
  executedContractId: string;
  transactionState: TransactionState;
}> {
  const tx = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
    include: { governingAgreement: true },
  });
  if (!tx) throw new HttpError(404, "Transaction not found", "NOT_FOUND");
  assertPreExecutionState(tx.state);

  const doc = await prisma.document.findFirst({
    where: { id: input.documentId, transactionId: tx.id },
    include: { versions: { orderBy: { version: "desc" } } },
  });
  if (!doc) throw new HttpError(404, "Document not found", "NOT_FOUND");
  if (doc.type !== DocumentType.EXECUTED_CONTRACT) {
    throw new HttpError(400, "Document must be of type EXECUTED_CONTRACT", "DOC_TYPE");
  }
  if (doc.ingestStatus !== DocumentIngestStatus.ACCEPTED) {
    throw new HttpError(409, "Document must be accepted before execution submit", "DOC_NOT_ACCEPTED");
  }

  const version = input.documentVersionId
    ? doc.versions.find((v) => v.id === input.documentVersionId)
    : doc.versions[0];
  if (!version) {
    throw new HttpError(400, "Document version not found", "NO_VERSION");
  }

  if (!tx.governingAgreement) {
    throw new HttpError(409, "Governing agreement required", "NO_GOVERNING");
  }

  await prisma.executedContract.updateMany({
    where: { transactionId: tx.id },
    data: { authoritative: false },
  });

  const created = await prisma.$transaction(async (db) => {
    const ec = await db.executedContract.create({
      data: {
        transactionId: tx.id,
        documentId: doc.id,
        documentVersionId: version.id,
        governingCandidateVersion: tx.governingAgreement!.candidateVersion,
        candidateReference: tx.governingAgreement!.referenceCode,
        storageKey: version.storageKey,
        sha256: version.sha256,
        uploadedByUserId: input.actorUserId,
        verificationStatus: ExecutedContractVerificationState.PENDING_VERIFICATION,
        authoritative: true,
      },
    });

    let newState = tx.state;
    if (tx.state === "GREEN_STAGE_1" || tx.state === "APPROVED") {
      const tr = await transitionTransaction({
        orgId: input.orgId,
        transactionId: tx.id,
        toState: "EXECUTED_PENDING_VERIFICATION",
        actorUserId: input.actorUserId,
        roles: input.roles,
        reason: "executed source instrument submitted",
        emitAudit: true,
        metadata: { executedContractId: ec.id } as Prisma.InputJsonValue,
      });
      newState = tr.to;
    }
    return { ec, newState };
  });

  await recordAudit({
    orgId: input.orgId,
    transactionId: tx.id,
    actorUserId: input.actorUserId,
    eventType: "EXECUTION_SUBMIT",
    action: "EXECUTION_SUBMIT",
    entityType: "ExecutedContract",
    entityId: created.ec.id,
    resource: "ExecutedContract",
    resourceId: created.ec.id,
    payload: { documentId: doc.id, versionId: version.id },
  });

  return { executedContractId: created.ec.id, transactionState: created.newState };
}

export function compareExecutionAgainstAuthoritativeData(input: {
  governingReference: string;
  amountFinanced: string;
  buyerLegalName: string;
  documentRequirementKey: string | null;
  executedSha256: string;
}): {
  comparedFields: Record<string, string>;
  mismatches: { field: string; expected: string; actual: string }[];
  result: "PASS" | "FAIL";
} {
  const comparedFields: Record<string, string> = {
    governingReference: input.governingReference,
    amountFinanced: input.amountFinanced,
    buyerLegalName: input.buyerLegalName,
    documentRequirementKey: input.documentRequirementKey ?? "",
    sourceSha256: input.executedSha256,
  };

  const mismatches: { field: string; expected: string; actual: string }[] = [];

  if (input.documentRequirementKey && input.documentRequirementKey !== input.governingReference) {
    mismatches.push({
      field: "requirementKey_vs_governingReference",
      expected: input.governingReference,
      actual: input.documentRequirementKey,
    });
  }

  if (mismatches.length > 0) {
    return { comparedFields, mismatches, result: "FAIL" };
  }
  return { comparedFields, mismatches, result: "PASS" };
}

export async function verifyExecution(input: {
  orgId: string;
  transactionId: string;
  actorUserId: string;
  executedContractId: string;
  roles: UserRole[];
}): Promise<{
  verification: { id: string; result: ExecutionVerificationResult; mismatches: unknown[] };
  executedContractId: string;
  transactionState: TransactionState;
}> {
  const tx = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
    include: {
      governingAgreement: true,
      buyer: true,
      financials: true,
    },
  });
  if (!tx) throw new HttpError(404, "Transaction not found", "NOT_FOUND");
  if (tx.state !== "EXECUTED_PENDING_VERIFICATION") {
    throw new HttpError(409, "Execution verification requires EXECUTED_PENDING_VERIFICATION", "STATE", {
      state: tx.state,
    });
  }

  const ec = await prisma.executedContract.findFirst({
    where: { id: input.executedContractId, transactionId: tx.id },
    include: { document: true, documentVersion: true },
  });
  if (!ec) throw new HttpError(404, "Executed contract not found", "NOT_FOUND");
  if (!ec.documentVersion) throw new HttpError(409, "No document version on executed contract", "NO_VERSION");
  if (!tx.governingAgreement || !tx.financials || !tx.buyer) {
    throw new HttpError(409, "Missing governing agreement, financials, or buyer", "INCOMPLETE");
  }

  const amountStr = tx.financials.amountFinanced.toString();
  const cmp = compareExecutionAgainstAuthoritativeData({
    governingReference: tx.governingAgreement.referenceCode,
    amountFinanced: amountStr,
    buyerLegalName: tx.buyer.legalName,
    documentRequirementKey: ec.document.requirementKey,
    executedSha256: ec.documentVersion.sha256,
  });

  const result =
    cmp.result === "PASS"
      ? ExecutionVerificationResult.PASS
      : ExecutionVerificationResult.FAIL;

  const inner = await prisma.$transaction(async (db) => {
    const row = await db.executionVerification.create({
      data: {
        transactionId: tx.id,
        executedContractId: ec.id,
        candidateReference: tx.governingAgreement!.referenceCode,
        comparedFieldsJson: cmp.comparedFields as Prisma.InputJsonValue,
        mismatchesJson: cmp.mismatches as Prisma.InputJsonValue,
        result,
        method: "REFERENCE_AND_REQUIREMENT_V1",
        actorUserId: input.actorUserId,
        metadataJson: { versionId: ec.documentVersionId } as Prisma.InputJsonValue,
      },
    });

    if (result === "PASS") {
      await db.executedContract.update({
        where: { id: ec.id },
        data: {
          verificationStatus: ExecutedContractVerificationState.VERIFIED,
          verifiedByUserId: input.actorUserId,
        },
      });
      return { row, done: true as const };
    }

    await db.executedContract.update({
      where: { id: ec.id },
      data: { verificationStatus: ExecutedContractVerificationState.REJECTED },
    });
    await db.discrepancy.create({
      data: {
        transactionId: tx.id,
        code: "EXECUTION_MISMATCH",
        message: "Executed source instrument failed authority verification",
        status: "OPEN",
      },
    });
    return { row, done: false as const };
  });

  const newState =
    inner.done
      ? tx.state
      : (
          await transitionTransaction({
            orgId: input.orgId,
            transactionId: tx.id,
            toState: "DISCREPANCY_RESTRICTED",
            actorUserId: input.actorUserId,
            roles: input.roles,
            reason: "execution verification failed",
            emitAudit: true,
          })
        ).to;

  const verification = inner.row;

  await recordAudit({
    orgId: input.orgId,
    transactionId: tx.id,
    actorUserId: input.actorUserId,
    eventType: "EXECUTION_VERIFY",
    action: "EXECUTION_VERIFY",
    entityType: "ExecutionVerification",
    entityId: inner.row.id,
    resource: "ExecutionVerification",
    resourceId: inner.row.id,
    payload: { result, mismatchCount: cmp.mismatches.length },
  });

  return {
    verification: {
      id: verification.id,
      result: verification.result,
      mismatches: cmp.mismatches,
    },
    executedContractId: ec.id,
    transactionState: newState,
  };
}

export async function getExecutionBundle(input: {
  orgId: string;
  transactionId: string;
}): Promise<{
  items: unknown;
}> {
  const ok = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
    select: { id: true },
  });
  if (!ok) throw new HttpError(404, "Transaction not found", "NOT_FOUND");
  const items = await prisma.executedContract.findMany({
    where: { transactionId: input.transactionId },
    orderBy: { createdAt: "desc" },
    include: { document: true, documentVersion: true, verifications: { orderBy: { verifiedAt: "desc" } } },
  });
  return { items };
}

export async function getExecutionVerifications(input: {
  orgId: string;
  transactionId: string;
}): Promise<{
  items: unknown;
}> {
  const ok = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
    select: { id: true },
  });
  if (!ok) throw new HttpError(404, "Transaction not found", "NOT_FOUND");
  const items = await prisma.executionVerification.findMany({
    where: { transactionId: input.transactionId },
    orderBy: { verifiedAt: "desc" },
  });
  return { items };
}
