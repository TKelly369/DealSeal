import { Queue } from "bullmq";
import { getQueueConnection } from "./connection.js";

const prefix = "dealseal";

let packageQueue: Queue | null | undefined;
let docValidationQueue: Queue | null | undefined;

export function getPackageJobQueue(): Queue | null {
  const conn = getQueueConnection();
  if (!conn) return null;
  if (packageQueue === undefined) {
    packageQueue = new Queue("package-job", { connection: conn as any, prefix });
  }
  return packageQueue;
}

export function getDocumentValidationQueue(): Queue | null {
  const conn = getQueueConnection();
  if (!conn) return null;
  if (docValidationQueue === undefined) {
    docValidationQueue = new Queue("document-validation", {
      connection: conn as any,
      prefix,
    });
  }
  return docValidationQueue;
}

export async function enqueuePackageJob(jobId: string): Promise<void> {
  const q = getPackageJobQueue();
  if (!q) return;
  await q.add(
    "process",
    { jobId },
    { jobId, removeOnComplete: 1000, removeOnFail: 5000 },
  );
}

export async function enqueueDocumentValidation(input: {
  documentId: string;
  version: number;
  transactionId: string;
}): Promise<void> {
  const q = getDocumentValidationQueue();
  if (!q) return;
  await q.add(
    "run",
    input,
    {
      jobId: `${input.documentId}:${input.version}`,
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  );
}
