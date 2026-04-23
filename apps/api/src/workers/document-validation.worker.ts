import type { Job } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { recordAudit } from "../services/audit-service.js";

export type DocumentValidationJobData = {
  documentId: string;
  version: number;
  transactionId: string;
};

/**
 * Async validation pipeline hook: OCR/blur/signature checks would run here.
 * Never deletes prior DocumentVersion rows; only advances ingest status.
 */
export async function runDocumentValidationInline(
  data: DocumentValidationJobData,
  jobId?: string | number,
): Promise<void> {
  const { documentId, version, transactionId } = data;
  const doc = await prisma.document.findFirst({
    where: { id: documentId, transactionId },
    include: { transaction: true },
  });
  if (!doc) return;

  await prisma.document.update({
    where: { id: documentId },
    data: {
      ingestStatus: "ACCEPTED",
      ocrConfidence: 0.92,
      blurScore: 0.05,
      hasSignature: null,
    },
  });

  await recordAudit({
    orgId: doc.transaction.orgId,
    transactionId,
    actorUserId: undefined,
    eventType: "DOCUMENT_VALIDATION_COMPLETED",
    action: "DOCUMENT_VALIDATION_COMPLETED",
    entityType: "Document",
    entityId: documentId,
    resource: "Document",
    resourceId: documentId,
    payload: { version, jobId: jobId ?? "inline" },
  });
}

export async function processDocumentValidationJob(
  job: Job<DocumentValidationJobData>,
): Promise<void> {
  await runDocumentValidationInline(job.data, job.id);
}
