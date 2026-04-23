import { createHash } from "node:crypto";
import type { Job } from "bullmq";
import { PackageJobStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { loadEnv } from "../config/env.js";
import { createS3Client, getBucket } from "../services/s3-service.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { recordAudit } from "../services/audit-service.js";
import { persistPackageCertificationRecord } from "../services/package-certification-service.js";

export type PackageJobQueuePayload = { jobId: string };

function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function minimalPdf(): Buffer {
  return Buffer.from(
    "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
    "utf-8",
  );
}

function toXml(obj: unknown): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const walk = (v: unknown, tag: string): string => {
    if (v === null || v === undefined) return `<${tag}/>`;
    if (typeof v !== "object") return `<${tag}>${esc(String(v))}</${tag}>`;
    if (Array.isArray(v)) {
      return `<${tag}>${v.map((x, i) => walk(x, `i${i}`)).join("")}</${tag}>`;
    }
    return `<${tag}>${Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => walk(val, k))
      .join("")}</${tag}>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>\n${walk(obj, "dealSeal")}`;
}

/** Deterministic: authoritative > immutable > higher version; tie-breaker id. */
function pickAuthoritativeVersion(
  versions: {
    id: string;
    version: number;
    sha256: string;
    storageKey: string;
    byteSize: bigint;
    isImmutable: boolean;
    authoritative: boolean;
  }[],
):
  | {
      id: string;
      version: number;
      sha256: string;
      storageKey: string;
      byteSize: bigint;
      isImmutable: boolean;
      authoritative: boolean;
    }
  | undefined {
  if (versions.length === 0) return undefined;
  const sorted = [...versions].sort((a, b) => {
    if (a.authoritative !== b.authoritative) return a.authoritative ? -1 : 1;
    if (a.isImmutable !== b.isImmutable) return a.isImmutable ? -1 : 1;
    if (a.version !== b.version) return b.version - a.version;
    return a.id.localeCompare(b.id);
  });
  return sorted[0];
}

export async function processPackageJob(job: Job<PackageJobQueuePayload>): Promise<void> {
  const env = loadEnv();
  const client = createS3Client(env);
  const bucket = getBucket(env);

  const pkg = await prisma.packageJob.findUnique({
    where: { id: job.data.jobId },
    include: {
      transaction: {
        include: {
          governingAgreement: true,
          buyer: true,
          vehicle: true,
          financials: true,
          authoritativeEmbodiments: { where: { active: true } },
          documents: {
            orderBy: { id: "asc" },
            include: { versions: { orderBy: [{ version: "desc" }] } },
          },
        },
      },
    },
  });
  if (!pkg) return;

  const tpl = await prisma.packageTemplate.findFirst({
    where: { key: pkg.templateKey, active: true },
  });

  await prisma.packageJob.update({
    where: { id: pkg.id },
    data: { status: PackageJobStatus.PROCESSING },
  });

  const tx = pkg.transaction;
  const financials = tx.financials
    ? {
        ...tx.financials,
        amountFinanced: tx.financials.amountFinanced.toString(),
      }
    : null;

  const docSorted = [...tx.documents].sort((a, b) => a.id.localeCompare(b.id));
  const documentsPayload = docSorted.map((d) => {
    const pick = pickAuthoritativeVersion(d.versions);
    return {
      id: d.id,
      type: d.type,
      ingestStatus: d.ingestStatus,
      selectedVersion: pick
        ? {
            id: pick.id,
            version: pick.version,
            sha256: pick.sha256,
            storageKey: pick.storageKey,
            byteSize: pick.byteSize.toString(),
            isImmutable: pick.isImmutable,
            authoritative: pick.authoritative,
          }
        : null,
    };
  });

  const authoritative = {
    templateKey: pkg.templateKey,
    packageKind: pkg.packageKind,
    certified: pkg.certified,
    template: tpl
      ? { key: tpl.key, name: tpl.name, version: tpl.version, spec: tpl.specJson }
      : null,
    transaction: {
      id: tx.id,
      publicId: tx.publicId,
      state: tx.state,
      validationVersion: tx.validationVersion,
    },
    governingAgreement: tx.governingAgreement,
    buyer: tx.buyer,
    vehicle: tx.vehicle,
    financials,
    documents: documentsPayload,
    authoritativeEmbodiments: tx.authoritativeEmbodiments.map((a) => ({
      id: a.id,
      digest: a.digest,
      storageKey: a.storageKey,
    })),
  };

  const manifestStr = JSON.stringify(authoritative, null, 2);
  const manifestBuf = Buffer.from(manifestStr, "utf-8");
  const bundleSha256 = sha256Hex(manifestBuf);

  const baseKey = `${tx.orgId}/${tx.id}/packages/${pkg.id}`;
  const manifestKey = `${baseKey}/manifest.json`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: manifestKey,
      Body: manifestBuf,
      ContentType: "application/json",
    }),
  );

  const outputKeys: string[] = [manifestKey];
  const artifacts: {
    format: (typeof pkg.formats)[number];
    key: string;
    buf: Buffer;
    mime: string;
  }[] = [];

  for (const format of [...pkg.formats].sort((a, b) => a.localeCompare(b))) {
    if (format === "JSON") {
      const buf = Buffer.from(manifestStr, "utf-8");
      const key = `${baseKey}/bundle.json`;
      artifacts.push({ format, key, buf, mime: "application/json" });
    } else if (format === "XML") {
      const buf = Buffer.from(toXml(authoritative), "utf-8");
      const key = `${baseKey}/bundle.xml`;
      artifacts.push({ format, key, buf, mime: "application/xml" });
    } else if (format === "PDF_BUNDLE") {
      const buf = minimalPdf();
      const key = `${baseKey}/bundle.pdf`;
      artifacts.push({ format, key, buf, mime: "application/pdf" });
    }
  }

  for (const a of artifacts) {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: a.key,
        Body: a.buf,
        ContentType: a.mime,
      }),
    );
    outputKeys.push(a.key);
  }

  await prisma.$transaction(async (db) => {
    for (const a of artifacts) {
      const digest = sha256Hex(a.buf);
      await db.generatedPackage.create({
        data: {
          packageJobId: pkg.id,
          format: a.format,
          storageKey: a.key,
          byteSize: BigInt(a.buf.length),
          sha256: digest,
          manifestJson: JSON.parse(JSON.stringify(authoritative)) as Prisma.InputJsonValue,
        },
      });
    }

    await db.packageJob.update({
      where: { id: pkg.id },
      data: {
        status: PackageJobStatus.SUCCEEDED,
        completedAt: new Date(),
        outputKeys,
        manifestStorageKey: manifestKey,
        bundleSha256,
      },
    });
  });

  if (
    pkg.certified ||
    ["CERTIFIED", "AUDIT", "AUTHORITY_FILE", "POST_FUNDING_COMPLETION"].includes(
      pkg.packageKind,
    )
  ) {
    const includedRefs = {
      documentVersionIds: docSorted
        .map((d) => pickAuthoritativeVersion(d.versions)?.id)
        .filter(Boolean),
      embodimentIds: tx.authoritativeEmbodiments.map((a) => a.id),
    };
    await persistPackageCertificationRecord({
      packageJobId: pkg.id,
      transactionId: tx.id,
      orgId: tx.orgId,
      packageType: pkg.packageKind,
      templateId: tpl?.id ?? null,
      manifestJson: JSON.parse(JSON.stringify(authoritative)) as Prisma.InputJsonValue,
      includedRefsJson: includedRefs as Prisma.InputJsonValue,
      stateSnapshotJson: (typeof pkg.stateSnapshotJson === "object" && pkg.stateSnapshotJson
        ? pkg.stateSnapshotJson
        : { state: tx.state }) as Prisma.InputJsonValue,
      certificationStatement: pkg.certified
        ? "This DealSeal certified package manifest was generated with deterministic document ordering, pinned snapshots, and cryptographic digests (internal certification v1)."
        : "This DealSeal package manifest is recorded for export traceability (internal certification v1).",
      generatedByUserId: pkg.requestedById,
    });
  }

  await recordAudit({
    orgId: tx.orgId,
    transactionId: tx.id,
    actorUserId: undefined,
    eventType: "PACKAGE_JOB_SUCCEEDED",
    action: "PACKAGE_JOB_SUCCEEDED",
    entityType: "PackageJob",
    entityId: pkg.id,
    resource: "PackageJob",
    resourceId: pkg.id,
    payload: { bundleSha256, outputKeys },
  });
}
