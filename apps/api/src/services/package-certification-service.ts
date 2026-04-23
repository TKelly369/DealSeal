import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import type { Prisma } from "@prisma/client";

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf-8").digest("hex");
}

/** Deterministic key ordering (deep). */
export function sortDeep(v: unknown): unknown {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(sortDeep);
  const o = v as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(o)
      .sort()
      .map((k) => [k, sortDeep(o[k])]),
  );
}

export function canonicalStringify(v: unknown): string {
  return JSON.stringify(sortDeep(v));
}

export function digestManifestPayload(payload: unknown): { contentDigest: string; body: string } {
  const body = canonicalStringify(payload);
  return { contentDigest: sha256Hex(body), body };
}

export async function persistPackageCertificationRecord(input: {
  packageJobId: string;
  transactionId: string;
  orgId: string;
  packageType: string;
  templateId: string | null;
  manifestJson: Prisma.InputJsonValue;
  includedRefsJson: Prisma.InputJsonValue;
  stateSnapshotJson: Prisma.InputJsonValue;
  certificationStatement: string;
  generatedByUserId: string;
}): Promise<{ id: string; packageDigest: string; verificationDigest: string }> {
  const { contentDigest, body } = digestManifestPayload(input.manifestJson);
  const { contentDigest: packageDigest } = digestManifestPayload({
    manifest: input.manifestJson,
    included: input.includedRefsJson,
    snapshot: input.stateSnapshotJson,
  });
  const { contentDigest: verificationDigest } = digestManifestPayload({
    packageDigest,
    algorithm: "sha256+canonical-json",
  });
  const row = await prisma.$transaction(async (db) => {
    const m = await db.packageManifest.create({
      data: {
        packageJobId: input.packageJobId,
        transactionId: input.transactionId,
        packageTemplateId: input.templateId,
        packageType: input.packageType,
        includedRefsJson: input.includedRefsJson,
        stateSnapshotJson: input.stateSnapshotJson,
        manifestJson: input.manifestJson,
        contentDigest,
        packageDigest,
        certificationStatement: input.certificationStatement,
        generatedByUserId: input.generatedByUserId,
      },
    });
    await db.packageVerification.create({
      data: {
        packageManifestId: m.id,
        verificationDigest,
        detailsJson: { bodySample: body.slice(0, 10_000) } as Prisma.InputJsonValue,
      },
    });
    return m;
  });
  return { id: row.id, packageDigest, verificationDigest };
}
