import "dotenv/config";
import { Worker } from "bullmq";
import { PackageJobStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { createWorkerConnection } from "../queue/connection.js";
import { recordAudit } from "../services/audit-service.js";
import { processDocumentValidationJob } from "./document-validation.worker.js";
import { processPackageJob } from "./package.worker.js";

const prefix = "dealseal";

const connection = createWorkerConnection();
if (!connection) {
  console.error("REDIS_URL is required for workers");
  process.exit(1);
}

const packageWorker = new Worker(
  "package-job",
  async (job) => {
    try {
      await processPackageJob(job);
    } catch (err) {
      console.error("package-job failed", job.id, err);
      const jobId =
        job.data && typeof job.data === "object" && "jobId" in job.data
          ? String((job.data as { jobId: string }).jobId)
          : "";
      if (!jobId) throw err;
      await prisma.packageJob.updateMany({
        where: { id: jobId },
        data: {
          status: PackageJobStatus.FAILED,
          error: String(err),
          completedAt: new Date(),
        },
      });
      const pkg = await prisma.packageJob.findFirst({
        where: { id: jobId },
        include: { transaction: { select: { orgId: true } } },
      });
      if (pkg) {
        await recordAudit({
          orgId: pkg.transaction.orgId,
          transactionId: pkg.transactionId,
          actorUserId: null,
          eventType: "PACKAGE_JOB_FAILED",
          action: "PACKAGE_JOB_FAILED",
          entityType: "PackageJob",
          entityId: jobId,
          resource: "PackageJob",
          resourceId: jobId,
          payload: { error: String(err), bullmqJobId: job.id },
        });
      }
      throw err;
    }
  },
  { connection: connection as any, prefix, concurrency: 2 },
);

const docWorker = new Worker(
  "document-validation",
  async (job) => {
    await processDocumentValidationJob(job);
  },
  { connection: connection as any, prefix, concurrency: 5 },
);

packageWorker.on("failed", (j, e) => console.error("package failed", j?.id, e));
docWorker.on("failed", (j, e) => console.error("doc validation failed", j?.id, e));

console.log("DealSeal workers listening (package-job, document-validation)");
