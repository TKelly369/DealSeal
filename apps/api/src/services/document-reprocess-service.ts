import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { assertNoActiveHold, canPatchDealData } from "./hold-service.js";
import { recordAudit } from "./audit-service.js";
import {
  enqueueDocumentValidation,
  getDocumentValidationQueue,
} from "../queue/queues.js";
import { runDocumentValidationInline } from "../workers/document-validation.worker.js";

export async function reprocessDocumentVersion(input: {
  orgId: string;
  documentId: string;
  actorUserId: string;
  version?: number;
  reqMeta: { ip?: string; userAgent?: string };
}): Promise<{ version: number; transactionId: string }> {
  const doc = await prisma.document.findFirst({
    where: { id: input.documentId, transaction: { orgId: input.orgId } },
    include: { transaction: true },
  });
  if (!doc) throw new HttpError(404, "Document not found", "NOT_FOUND");

  await assertNoActiveHold({
    orgId: input.orgId,
    transactionId: doc.transactionId,
  });
  if (!canPatchDealData(doc.transaction.state)) {
    throw new HttpError(423, "Transaction state forbids reprocess", "STATE_BLOCKED");
  }

  const target = await prisma.documentVersion.findFirst({
    where: {
      documentId: input.documentId,
      ...(input.version !== undefined ? { version: input.version } : {}),
    },
    orderBy: { version: "desc" },
  });
  if (!target) throw new HttpError(404, "Document version not found", "NOT_FOUND");

  await prisma.document.update({
    where: { id: doc.id },
    data: { ingestStatus: "VALIDATING" },
  });

  await recordAudit({
    orgId: input.orgId,
    transactionId: doc.transactionId,
    actorUserId: input.actorUserId,
    eventType: "DOCUMENT_REPROCESS",
    action: "DOCUMENT_REPROCESS",
    entityType: "Document",
    entityId: doc.id,
    resource: "Document",
    resourceId: doc.id,
    payload: { version: target.version },
    ip: input.reqMeta.ip,
    userAgent: input.reqMeta.userAgent,
  });

  const payload = {
    documentId: doc.id,
    version: target.version,
    transactionId: doc.transactionId,
  };
  if (getDocumentValidationQueue()) {
    await enqueueDocumentValidation(payload);
  } else {
    await runDocumentValidationInline(payload, "reprocess");
  }

  return { version: target.version, transactionId: doc.transactionId };
}
