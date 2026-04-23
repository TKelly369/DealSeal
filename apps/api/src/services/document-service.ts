import { randomUUID } from "node:crypto";
import type { DocumentType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { canPatchDealData, isTerminalReadOnlyState } from "./hold-service.js";

export async function registerDocumentVersion(input: {
  orgId: string;
  transactionId: string;
  documentId: string;
  storageKey: string;
  mimeType: string;
  byteSize: bigint;
  sha256: string;
  immutable?: boolean;
}): Promise<{ version: number }> {
  const tx = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
  });
  if (!tx) throw new HttpError(404, "Transaction not found", "NOT_FOUND");
  if (isTerminalReadOnlyState(tx.state) || !canPatchDealData(tx.state)) {
    throw new HttpError(
      423,
      "Cannot mutate documents in current transaction state",
      "IMMUTABLE",
    );
  }

  const doc = await prisma.document.findFirst({
    where: { id: input.documentId, transactionId: input.transactionId },
  });
  if (!doc) throw new HttpError(404, "Document not found", "NOT_FOUND");

  const last = await prisma.documentVersion.findFirst({
    where: { documentId: doc.id },
    orderBy: { version: "desc" },
  });
  const nextVersion = (last?.version ?? 0) + 1;

  await prisma.documentVersion.create({
    data: {
      documentId: doc.id,
      version: nextVersion,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      sha256: input.sha256,
      isImmutable: input.immutable ?? false,
    },
  });

  return { version: nextVersion };
}

export function buildObjectKey(
  orgId: string,
  transactionId: string,
  documentId: string,
): string {
  return `${orgId}/${transactionId}/${documentId}/${randomUUID()}`;
}

export async function createDocumentStub(input: {
  transactionId: string;
  orgId: string;
  type: DocumentType;
  requirementKey?: string;
}): Promise<{ id: string }> {
  const tx = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
  });
  if (!tx) throw new HttpError(404, "Transaction not found", "NOT_FOUND");
  if (!canPatchDealData(tx.state)) {
    throw new HttpError(423, "Cannot create documents in current state", "STATE_BLOCKED");
  }

  const doc = await prisma.document.create({
    data: {
      transactionId: input.transactionId,
      type: input.type,
      ...(input.requirementKey
        ? { requirementKey: input.requirementKey }
        : {}),
    },
  });
  return { id: doc.id };
}
