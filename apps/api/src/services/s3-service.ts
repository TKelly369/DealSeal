import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";

export function createS3Client(env: Env): S3Client {
  if (
    !env.S3_ENDPOINT ||
    !env.S3_ACCESS_KEY ||
    !env.S3_SECRET_KEY ||
    !env.S3_BUCKET
  ) {
    throw new HttpError(501, "Object storage not configured", "S3_DISABLED");
  }
  return new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
    forcePathStyle: true,
  });
}

export function getBucket(env: Env): string {
  if (!env.S3_BUCKET) throw new HttpError(501, "S3 bucket missing", "S3_DISABLED");
  return env.S3_BUCKET;
}

export async function presignPutObject(input: {
  env: Env;
  key: string;
  contentType: string;
  maxBytes: number;
  expiresSeconds?: number;
}): Promise<{ url: string; headers: Record<string, string> }> {
  const client = createS3Client(input.env);
  const bucket = getBucket(input.env);
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: input.key,
    ContentType: input.contentType,
  });
  const url = await getSignedUrl(client, cmd, {
    expiresIn: input.expiresSeconds ?? 900,
  });
  return {
    url,
    headers: {
      "Content-Type": input.contentType,
      "x-amz-meta-max-bytes": String(input.maxBytes),
    },
  };
}

export async function headObjectMeta(
  env: Env,
  key: string,
): Promise<{ contentLength: number; etag?: string }> {
  const client = createS3Client(env);
  const bucket = getBucket(env);
  const out = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key }),
  );
  const len = out.ContentLength ?? 0;
  return { contentLength: len, etag: out.ETag };
}

export async function copyObjectInBucket(
  env: Env,
  fromKey: string,
  toKey: string,
): Promise<void> {
  const client = createS3Client(env);
  const bucket = getBucket(env);
  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: toKey,
      CopySource: `${bucket}/${fromKey}`,
      MetadataDirective: "COPY",
    }),
  );
}

export async function deleteObjectIfPresent(env: Env, key: string): Promise<void> {
  const client = createS3Client(env);
  const bucket = getBucket(env);
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch {
    /* best-effort cleanup */
  }
}
