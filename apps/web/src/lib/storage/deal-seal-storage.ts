import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloud-ready object storage abstraction. Switch providers via `STORAGE_DRIVER`.
 * Keys are canonical paths without sensitive data (use opaque ids + safe file tokens).
 */
export type StorageDriver = "local" | "s3";

export type PutDealObjectParams = {
  key: string;
  body: Buffer;
  contentType?: string;
  /** Optional SHA-256 of body for integrity (returned for metadata persistence). */
  computeSha256?: boolean;
};

export type PutDealObjectResult = {
  key: string;
  storageProvider: "LOCAL" | "S3";
  sha256?: string;
};

function rootPrefix(): string {
  const env = process.env.STORAGE_ENVIRONMENT?.trim() || process.env.NODE_ENV || "development";
  return env.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Deterministic object key: {env}/{tenantId}/deals/{dealId}/docs/{docId}/v{version}/{safeName} */
export function buildStructuredObjectKey(input: {
  tenantId: string;
  dealId: string;
  documentId: string;
  version: number;
  safeFileToken: string;
}): string {
  const safe = input.safeFileToken.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200) || "file.bin";
  return [
    rootPrefix(),
    input.tenantId,
    "deals",
    input.dealId,
    "docs",
    input.documentId,
    `v${input.version}`,
    safe,
  ].join("/");
}

export function safeDisplayToken(): string {
  return randomUUID().replace(/-/g, "").slice(0, 16);
}

export interface DealSealStorageAdapter {
  readonly providerLabel: "LOCAL" | "S3";
  putObject(params: PutDealObjectParams): Promise<PutDealObjectResult>;
  presignedGetUrl(key: string, opts?: { expiresSeconds?: number; filename?: string }): Promise<string>;
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

class LocalDealSealStorage implements DealSealStorageAdapter {
  readonly providerLabel = "LOCAL" as const;

  private rootDir(): string {
    const r = process.env.LOCAL_STORAGE_ROOT?.trim() || path.join(process.cwd(), ".data", "dealseal-storage");
    return path.resolve(r);
  }

  async putObject(params: PutDealObjectParams): Promise<PutDealObjectResult> {
    const full = path.join(this.rootDir(), ...params.key.split("/").filter(Boolean));
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, params.body);
    return {
      key: params.key,
      storageProvider: "LOCAL",
      sha256: params.computeSha256 ? sha256(params.body) : undefined,
    };
  }

  async presignedGetUrl(key: string, opts?: { expiresSeconds?: number; filename?: string }): Promise<string> {
    const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
    const q = new URLSearchParams({ k: key });
    if (opts?.filename) q.set("fn", opts.filename);
    return `${base}/api/custody/download?${q.toString()}`;
  }
}

class S3DealSealStorage implements DealSealStorageAdapter {
  readonly providerLabel = "S3" as const;

  private client(): { client: S3Client; bucket: string; region: string } {
    const bucket = process.env.S3_BUCKET?.trim();
    const region = process.env.S3_REGION?.trim() || "us-east-1";
    const accessKeyId = process.env.S3_ACCESS_KEY?.trim() || process.env.AWS_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.S3_SECRET_KEY?.trim() || process.env.AWS_SECRET_ACCESS_KEY?.trim();
    const endpoint = process.env.S3_ENDPOINT?.trim();
    if (!bucket || !accessKeyId || !secretAccessKey) {
      throw new Error("S3 storage: set S3_BUCKET, S3_ACCESS_KEY, and S3_SECRET_KEY (or AWS_* equivalents).");
    }
    const client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });
    return { client, bucket, region };
  }

  async putObject(params: PutDealObjectParams): Promise<PutDealObjectResult> {
    const { client, bucket } = this.client();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType || "application/octet-stream",
      }),
    );
    return {
      key: params.key,
      storageProvider: "S3",
      sha256: params.computeSha256 ? sha256(params.body) : undefined,
    };
  }

  async presignedGetUrl(key: string, opts?: { expiresSeconds?: number; filename?: string }): Promise<string> {
    const { client, bucket } = this.client();
    return getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ...(opts?.filename
          ? { ResponseContentDisposition: `attachment; filename="${opts.filename.replace(/"/g, "")}"` }
          : {}),
      }),
      { expiresIn: opts?.expiresSeconds ?? 300 },
    );
  }
}

let cached: DealSealStorageAdapter | null = null;

export function getDealSealStorage(): DealSealStorageAdapter {
  if (cached) return cached;
  const driver = (process.env.STORAGE_DRIVER?.trim().toLowerCase() ||
    (process.env.S3_BUCKET?.trim() ? "s3" : "local")) as StorageDriver;
  cached = driver === "s3" ? new S3DealSealStorage() : new LocalDealSealStorage();
  return cached;
}

/** Resolve bytes from local root (used by authenticated download route). */
export async function readLocalObject(key: string): Promise<Buffer | null> {
  const root = process.env.LOCAL_STORAGE_ROOT?.trim() || path.join(process.cwd(), ".data", "dealseal-storage");
  const full = path.join(path.resolve(root), ...key.split("/").filter(Boolean));
  const rel = path.relative(path.resolve(root), full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  try {
    return await readFile(full);
  } catch {
    return null;
  }
}
