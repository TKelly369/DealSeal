import { randomUUID } from "node:crypto";
import type { DocumentIngestStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { assertNoActiveHold, canPatchDealData } from "./hold-service.js";
import {
  copyObjectInBucket,
  computeObjectSha256,
  deleteObjectIfPresent,
  headObjectMeta,
  presignPutObject,
} from "./s3-service.js";
import type { Env } from "../config/env.js";
import { recordAudit } from "./audit-service.js";
import {
  enqueueDocumentValidation,
  getDocumentValidationQueue,
} from "../queue/queues.js";
import { runDocumentValidationInline } from "../workers/document-validation.worker.js";

const ALLOWED_UPLOAD_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/octet-stream",
]);

export function isUploadMimeAllowed(mime: string): boolean {
  return ALLOWED_UPLOAD_MIME.has(mime);
}

function permanentObjectKey(
  orgId: string,
  transactionId: string,
  documentId: string,
  version: number,
): string {
  return `${orgId}/${transactionId}/documents/${documentId}/v${version}`;
}

export async function createDocumentUploadIntent(input: {
  env: Env;
  orgId: string;
  actorUserId: string;
  transactionId: string;
  documentId: string;
  mimeType: string;
  maxBytes: number;
  sha256Declared?: string;
  expiresMinutes?: number;
}): Promise<{
  intentId: string;
  stagingKey: string;
  upload: { url: string; headers: Record<string, string> };
  expiresAt: string;
}> {
  await assertNoActiveHold({
    orgId: input.orgId,
    transactionId: input.transactionId,
  });
  const tx = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
  });
  if (!tx) throw new HttpError(404, "Transaction not found", "NOT_FOUND");
  if (!canPatchDealData(tx.state)) {
    throw new HttpError(423, "Transaction state forbids uploads", "STATE_BLOCKED");
  }

  const doc = await prisma.document.findFirst({
    where: { id: input.documentId, transactionId: input.transactionId },
  });
  if (!doc) throw new HttpError(404, "Document not found", "NOT_FOUND");
  if (!isUploadMimeAllowed(input.mimeType)) {
    throw new HttpError(400, "Unsupported MIME type for upload", "MIME");
  }

  const intentId = randomUUID();
  const stagingKey = `${input.orgId}/staging/${intentId}`;
  const expiresAt = new Date(
    Date.now() + (input.expiresMinutes ?? 15) * 60 * 1000,
  );

  await prisma.documentUploadIntent.create({
    data: {
      id: intentId,
      documentId: doc.id,
      transactionId: input.transactionId,
      orgId: input.orgId,
      stagingKey,
      mimeType: input.mimeType,
      maxBytes: BigInt(input.maxBytes),
      sha256Declared: input.sha256Declared,
      expiresAt,
      createdByUserId: input.actorUserId,
    },
  });

  const upload = await presignPutObject({
    env: input.env,
    key: stagingKey,
    contentType: input.mimeType,
    maxBytes: input.maxBytes,
    expiresSeconds: (input.expiresMinutes ?? 15) * 60,
  });

  await recordAudit({
    orgId: input.orgId,
    transactionId: input.transactionId,
    actorUserId: input.actorUserId,
    eventType: "DOCUMENT_UPLOAD_INTENT",
    action: "DOCUMENT_UPLOAD_INTENT",
    entityType: "DocumentUploadIntent",
    entityId: intentId,
    resource: "DocumentUploadIntent",
    resourceId: intentId,
    payload: { documentId: doc.id, stagingKey },
  });

  return {
    intentId,
    stagingKey,
    upload,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function finalizeDocumentUpload(input: {
  env: Env;
  orgId: string;
  actorUserId: string;
  actorRoles: string[];
  documentId: string;
  intentId: string;
  sha256: string;
  immutable?: boolean;
  authoritative?: boolean;
  reqMeta: { ip?: string; userAgent?: string };
}): Promise<{
  version: number;
  storageKey: string;
  ingestStatus: DocumentIngestStatus;
  transactionId: string;
  mimeType: string;
  contentSha256Hash: string;
  fileName: string;
  documentType: string;
}> {
  const intent = await prisma.documentUploadIntent.findFirst({
    where: {
      id: input.intentId,
      documentId: input.documentId,
      orgId: input.orgId,
    },
    include: { document: true },
  });
  if (!intent) throw new HttpError(404, "Upload intent not found", "NOT_FOUND");
  await assertNoActiveHold({
    orgId: input.orgId,
    transactionId: intent.transactionId,
  });
  if (intent.status !== "PENDING") {
    throw new HttpError(409, "Intent not pending", "INTENT_STATE");
  }
  if (intent.expiresAt.getTime() < Date.now()) {
    await prisma.documentUploadIntent.update({
      where: { id: intent.id },
      data: { status: "EXPIRED" },
    });
    throw new HttpError(410, "Upload intent expired", "INTENT_EXPIRED");
  }
  if (intent.sha256Declared && intent.sha256Declared !== input.sha256) {
    throw new HttpError(400, "sha256 mismatch with declared value", "CHECKSUM");
  }

  const isAdmin = input.actorRoles.includes("ADMIN");
  if (!isAdmin && intent.createdByUserId !== input.actorUserId) {
    throw new HttpError(403, "Intent owned by another user", "INTENT_OWNER");
  }

  const stagingPrefix = `${input.orgId}/staging/`;
  if (!intent.stagingKey.startsWith(stagingPrefix)) {
    throw new HttpError(400, "Unexpected staging key shape", "STAGING_KEY");
  }

  const tx = await prisma.transaction.findFirst({
    where: { id: intent.transactionId, orgId: input.orgId },
  });
  if (!tx) throw new HttpError(404, "Transaction not found", "NOT_FOUND");
  if (!canPatchDealData(tx.state)) {
    throw new HttpError(423, "Transaction state forbids uploads", "STATE_BLOCKED");
  }

  const meta = await headObjectMeta(input.env, intent.stagingKey);
  if (meta.contentLength <= 0) {
    throw new HttpError(400, "Staging object missing or empty", "STAGING_EMPTY");
  }
  if (meta.contentLength > Number(intent.maxBytes)) {
    throw new HttpError(400, "Object exceeds declared max size", "SIZE_CAP");
  }
  const contentSha256Hash = await computeObjectSha256(input.env, intent.stagingKey);
  if (contentSha256Hash !== input.sha256) {
    throw new HttpError(400, "sha256 mismatch with uploaded bytes", "CHECKSUM_BYTES");
  }

  const immutableLock = await prisma.documentVersion.findFirst({
    where: { documentId: intent.documentId, isImmutable: true },
  });
  if (immutableLock) {
    throw new HttpError(
      423,
      "Document has an immutable version; cannot add new blobs",
      "IMMUTABLE_DOCUMENT",
    );
  }

  const dup = await prisma.documentVersion.findFirst({
    where: {
      sha256: input.sha256,
      document: { transactionId: intent.transactionId },
    },
  });
  if (dup) {
    throw new HttpError(409, "Duplicate object checksum in this transaction", "DUPLICATE_SHA");
  }

  const result = await prisma.$transaction(async (db) => {
    const last = await db.documentVersion.findFirst({
      where: { documentId: intent.documentId },
      orderBy: { version: "desc" },
    });
    const nextVersion = (last?.version ?? 0) + 1;
    const storageKey = permanentObjectKey(
      input.orgId,
      intent.transactionId,
      intent.documentId,
      nextVersion,
    );

    await copyObjectInBucket(input.env, intent.stagingKey, storageKey);

    const derivedRenderKey = `${storageKey}#render-placeholder`;

    await db.documentVersion.create({
      data: {
        documentId: intent.documentId,
        version: nextVersion,
        storageKey,
        mimeType: intent.mimeType,
        byteSize: BigInt(meta.contentLength),
        sha256: contentSha256Hash,
        isImmutable: input.immutable ?? false,
        authoritative: input.authoritative ?? false,
        derivedRenderKey,
        parentVersionId: last?.id,
      },
    });

    await db.documentUploadIntent.update({
      where: { id: intent.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    await db.document.update({
      where: { id: intent.documentId },
      data: { ingestStatus: "VALIDATING" },
    });

    return {
      version: nextVersion,
      storageKey,
      ingestStatus: "VALIDATING" as const,
    };
  });

  await deleteObjectIfPresent(input.env, intent.stagingKey);

  await recordAudit({
    orgId: input.orgId,
    transactionId: intent.transactionId,
    actorUserId: input.actorUserId,
    eventType: "DOCUMENT_UPLOAD_FINALIZE",
    action: "DOCUMENT_UPLOAD_FINALIZE",
    entityType: "Document",
    entityId: input.documentId,
    resource: "Document",
    resourceId: input.documentId,
    payload: {
      intentId: input.intentId,
      version: result.version,
      sha256: contentSha256Hash,
    },
    ip: input.reqMeta.ip,
    userAgent: input.reqMeta.userAgent,
  });

  const validationPayload = {
    documentId: intent.documentId,
    version: result.version,
    transactionId: intent.transactionId,
  };
  if (getDocumentValidationQueue()) {
    await enqueueDocumentValidation(validationPayload);
  } else {
    await runDocumentValidationInline(validationPayload, "sync-fallback");
  }

  return {
    ...result,
    transactionId: intent.transactionId,
    mimeType: intent.mimeType,
    contentSha256Hash,
    fileName: intent.stagingKey.split("/").at(-1) ?? intent.document.id,
    documentType: intent.document.type,
  };
}
