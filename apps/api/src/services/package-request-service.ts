import { PackageFormat, PackageJobStatus, type PackageJob } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { recordAudit } from "./audit-service.js";
import { recordUsage } from "./pricing-engine.js";
import { enqueuePackageJob } from "../queue/queues.js";

export async function createPackageJob(input: {
  orgId: string;
  actorUserId: string;
  transactionId: string;
  formats: PackageFormat[];
  templateKey?: string;
  certified?: boolean;
  /** STANDARD | CERTIFIED | AUDIT | AUTHORITY_FILE | POST_FUNDING_COMPLETION */
  packageKind?: string;
}): Promise<PackageJob> {
  const tx = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
  });
  if (!tx) throw new HttpError(404, "Transaction not found", "NOT_FOUND");

  const templateKey = input.templateKey ?? "default-v1";
  const tpl = await prisma.packageTemplate.findFirst({
    where: { key: templateKey, active: true },
  });
  if (!tpl) {
    throw new HttpError(400, "Unknown or inactive package template", "TEMPLATE");
  }

  const packageKind = input.packageKind ?? (input.certified ? "CERTIFIED" : "STANDARD");
  const job = await prisma.packageJob.create({
    data: {
      transactionId: input.transactionId,
      formats: input.formats,
      status: PackageJobStatus.QUEUED,
      templateKey,
      requestedById: input.actorUserId,
      packageKind,
      certified: input.certified ?? packageKind === "CERTIFIED",
      stateSnapshotJson: { state: tx.state, at: new Date().toISOString() },
    },
  });

  const exportType = input.certified ? "CERTIFIED_PACKAGE" : "DOCUMENT_EXPORT";
  await recordUsage(prisma, {
    orgId: input.orgId,
    transactionId: input.transactionId,
    eventType: exportType,
    quantity: 1,
    idempotencyKey: `pkg:${job.id}`,
  });

  await recordAudit({
    orgId: input.orgId,
    transactionId: input.transactionId,
    actorUserId: input.actorUserId,
    eventType: "PACKAGE_JOB_CREATE",
    action: "PACKAGE_JOB_CREATE",
    entityType: "PackageJob",
    entityId: job.id,
    resource: "PackageJob",
    resourceId: job.id,
    payload: { formats: input.formats, templateKey },
  });

  await enqueuePackageJob(job.id);

  return (await prisma.packageJob.findUnique({
    where: { id: job.id },
  }))!;
}
