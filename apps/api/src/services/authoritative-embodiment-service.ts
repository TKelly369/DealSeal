import { createHash } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { loadEnv } from "../config/env.js";
import { createS3Client, getBucket } from "./s3-service.js";
import { recordAudit } from "./audit-service.js";
import { canonicalStringify } from "./package-certification-service.js";

function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export async function generateAuthoritativeEmbodiment(input: {
  orgId: string;
  transactionId: string;
  actorUserId: string;
}): Promise<{
  id: string;
  storageKey: string;
  digest: string;
  version: number;
}> {
  const tx = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
    include: {
      governingAgreement: true,
      buyer: true,
      vehicle: true,
      financials: true,
      executedContracts: {
        where: { verificationStatus: "VERIFIED", authoritative: true },
        take: 1,
        include: { documentVersion: true },
      },
    },
  });
  if (!tx) throw new HttpError(404, "Transaction not found", "NOT_FOUND");
  if (tx.state !== "LOCKED" && tx.state !== "POST_FUNDING_PENDING" && tx.state !== "COMPLETED" && tx.state !== "GREEN_STAGE_2") {
    throw new HttpError(409, "Authoritative embodiment requires a locked or post-lock state", "STATE", {
      state: tx.state,
    });
  }
  const ec = tx.executedContracts[0];
  if (!ec) {
    throw new HttpError(409, "No verified executed source instrument", "NO_EXECUTED");
  }

  const financials = tx.financials
    ? { ...tx.financials, amountFinanced: tx.financials.amountFinanced.toString() }
    : null;
  const body = {
    kind: "DealSeal.AuthoritativeEmbodiment",
    version: 1,
    transaction: { id: tx.id, publicId: tx.publicId, state: tx.state },
    governingAgreement: tx.governingAgreement,
    executedContract: { id: ec.id, sha256: ec.sha256, documentVersionId: ec.documentVersionId },
    buyer: tx.buyer,
    vehicle: tx.vehicle,
    financials,
  };
  const canonical = canonicalStringify(body);
  const buf = Buffer.from(canonical, "utf-8");
  const digest = sha256Hex(buf);

  const env = loadEnv();
  const client = createS3Client(env);
  const bucket = getBucket(env);
  const storageKey = `${tx.orgId}/${tx.id}/authoritative-embodiment/${digest.slice(0, 16)}.json`;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: buf,
      ContentType: "application/json",
    }),
  );

  const version = await prisma.$transaction(async (db) => {
    await db.authoritativeEmbodiment.updateMany({
      where: { transactionId: tx.id, active: true },
      data: { active: false },
    });
    const row = await db.authoritativeEmbodiment.create({
      data: {
        transactionId: tx.id,
        executedContractId: ec.id,
        representationType: "STRUCTURED_DEALSEAL",
        outputFormat: "json",
        storageKey,
        digest,
        version: 1,
        active: true,
        generatedByUserId: input.actorUserId,
        serviceName: "authoritative-embodiment",
      },
    });
    return row;
  });

  await recordAudit({
    orgId: input.orgId,
    transactionId: tx.id,
    actorUserId: input.actorUserId,
    eventType: "AUTHORITY_EMBODIMENT",
    action: "AUTHORITY_EMBODIMENT_GENERATE",
    entityType: "AuthoritativeEmbodiment",
    entityId: version.id,
    resource: "AuthoritativeEmbodiment",
    resourceId: version.id,
    payload: { digest, storageKey },
  });

  return { id: version.id, storageKey, digest, version: version.version };
}

export async function getAuthoritativeEmbodiment(input: {
  orgId: string;
  transactionId: string;
}): Promise<{
  items: Awaited<ReturnType<typeof prisma.authoritativeEmbodiment.findMany>>;
}> {
  const ok = await prisma.transaction.findFirst({
    where: { id: input.transactionId, orgId: input.orgId },
    select: { id: true },
  });
  if (!ok) throw new HttpError(404, "Transaction not found", "NOT_FOUND");
  const items = await prisma.authoritativeEmbodiment.findMany({
    where: { transactionId: input.transactionId },
    orderBy: { createdAt: "desc" },
    include: { executedContract: { include: { document: true } } },
  });
  return { items };
}
