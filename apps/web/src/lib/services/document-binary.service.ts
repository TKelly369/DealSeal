/**
 * Binary document vault backed by S3-compatible APIs today.
 * Prefer composing keys via `@/lib/storage/deal-seal-storage` (`buildStructuredObjectKey`) for new flows
 * so uploads stay aligned with the custodial abstraction (`STORAGE_DRIVER=local|s3`).
 */
import { randomUUID } from "crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type BinaryManifestEntry = {
  version: number;
  objectKey: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  uploadedAt: string;
  uploadedBy: string;
};

type BinaryManifest = {
  latestVersion: number;
  versions: BinaryManifestEntry[];
};

function requireStorageConfig() {
  const bucket = process.env.S3_BUCKET?.trim();
  const region = process.env.S3_REGION?.trim() || "us-east-1";
  const accessKeyId = process.env.S3_ACCESS_KEY?.trim() || process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_KEY?.trim() || process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const endpoint = process.env.S3_ENDPOINT?.trim();
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Object storage is not configured. Set S3_BUCKET, S3_ACCESS_KEY, and S3_SECRET_KEY.");
  }
  return { bucket, region, accessKeyId, secretAccessKey, endpoint };
}

function makeClient() {
  const cfg = requireStorageConfig();
  return new S3Client({
    region: cfg.region,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    ...(cfg.endpoint
      ? {
          endpoint: cfg.endpoint,
          forcePathStyle: true,
        }
      : {}),
  });
}

function manifestKey(workspaceId: string, documentId: string) {
  return `${workspaceId}/documents/${documentId}/manifest.json`;
}

function objectKey(workspaceId: string, documentId: string, version: number, originalName: string) {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${workspaceId}/documents/${documentId}/v${version}/${safeName}`;
}

async function readManifest(workspaceId: string, documentId: string): Promise<BinaryManifest> {
  const client = makeClient();
  const cfg = requireStorageConfig();
  try {
    const out = await client.send(
      new GetObjectCommand({
        Bucket: cfg.bucket,
        Key: manifestKey(workspaceId, documentId),
      }),
    );
    const body = await out.Body?.transformToString();
    if (!body) return { latestVersion: 0, versions: [] };
    const parsed = JSON.parse(body) as BinaryManifest;
    return parsed?.versions ? parsed : { latestVersion: 0, versions: [] };
  } catch {
    return { latestVersion: 0, versions: [] };
  }
}

async function writeManifest(workspaceId: string, documentId: string, manifest: BinaryManifest): Promise<void> {
  const client = makeClient();
  const cfg = requireStorageConfig();
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: manifestKey(workspaceId, documentId),
      Body: JSON.stringify(manifest),
      ContentType: "application/json",
    }),
  );
}

export async function uploadDocumentBinary(input: {
  workspaceId: string;
  documentId: string;
  file: File;
  actorUserId: string;
}): Promise<{ version: number; byteSize: number; mimeType: string; fileName: string }> {
  if (!input.file || input.file.size <= 0) {
    throw new Error("Choose a file to upload.");
  }
  const client = makeClient();
  const cfg = requireStorageConfig();
  const manifest = await readManifest(input.workspaceId, input.documentId);
  const nextVersion = manifest.latestVersion + 1;
  const fileName = input.file.name?.trim() || `${randomUUID()}.bin`;
  const key = objectKey(input.workspaceId, input.documentId, nextVersion, fileName);
  const data = Buffer.from(await input.file.arrayBuffer());
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: data,
      ContentType: input.file.type || "application/octet-stream",
    }),
  );

  const entry: BinaryManifestEntry = {
    version: nextVersion,
    objectKey: key,
    fileName,
    mimeType: input.file.type || "application/octet-stream",
    byteSize: data.byteLength,
    uploadedAt: new Date().toISOString(),
    uploadedBy: input.actorUserId,
  };
  const updated: BinaryManifest = {
    latestVersion: nextVersion,
    versions: [...manifest.versions, entry],
  };
  await writeManifest(input.workspaceId, input.documentId, updated);

  return {
    version: nextVersion,
    byteSize: entry.byteSize,
    mimeType: entry.mimeType,
    fileName: entry.fileName,
  };
}

export async function createDocumentDownloadUrl(input: {
  workspaceId: string;
  documentId: string;
  expiresSeconds?: number;
}): Promise<{ url: string; fileName: string; version: number }> {
  const manifest = await readManifest(input.workspaceId, input.documentId);
  const latest = manifest.versions[manifest.versions.length - 1];
  if (!latest) {
    throw new Error("No file content uploaded for this document yet.");
  }
  const client = makeClient();
  const cfg = requireStorageConfig();
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: cfg.bucket,
      Key: latest.objectKey,
      ResponseContentDisposition: `attachment; filename="${latest.fileName}"`,
    }),
    { expiresIn: input.expiresSeconds ?? 300 },
  );
  return { url, fileName: latest.fileName, version: latest.version };
}
