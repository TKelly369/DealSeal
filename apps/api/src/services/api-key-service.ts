import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { recordUsage } from "./pricing-engine.js";
import { logger } from "../lib/logger.js";

const PREFIX = "dsk_";

function hashKey(raw: string): string {
  return createHash("sha256").update(raw, "utf-8").digest("hex");
}

export async function createApiKeyForOrg(input: {
  orgId: string;
  name: string;
  createdByUserId: string;
  scopes?: string[];
}): Promise<{ id: string; keyPrefix: string; secret: string; displayOnce: string }> {
  const secretBytes = randomBytes(24).toString("base64url");
  const full = `${PREFIX}${secretBytes}`;
  const keyHash = hashKey(full);
  const keyPrefix = full.slice(0, 12);
  const row = await prisma.apiKey.create({
    data: {
      orgId: input.orgId,
      name: input.name,
      keyPrefix,
      keyHash,
      scopes: input.scopes ?? ["read:transactions", "read:packages", "read:status"],
      createdByUserId: input.createdByUserId,
    },
  });
  logger.info("api_key_created", { orgId: input.orgId, keyId: row.id });
  return { id: row.id, keyPrefix, secret: full, displayOnce: full };
}

export type PartnerAuth = {
  orgId: string;
  apiKeyId: string;
  scopes: string[];
};

export async function verifyApiKey(
  headerKey: string | undefined,
): Promise<PartnerAuth | null> {
  if (!headerKey || !headerKey.startsWith(PREFIX)) return null;
  const h = hashKey(headerKey);
  const row = await prisma.apiKey.findFirst({
    where: { keyHash: h, active: true },
  });
  if (!row) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;
  await prisma.apiKey
    .update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});
  return { orgId: row.orgId, apiKeyId: row.id, scopes: row.scopes };
}

export async function recordApiUsage(input: {
  orgId: string;
  apiKeyId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
}): Promise<void> {
  await prisma.apiUsageLog.create({
    data: {
      orgId: input.orgId,
      apiKeyId: input.apiKeyId,
      method: input.method,
      path: input.path,
      statusCode: input.statusCode,
      durationMs: input.durationMs,
    },
  });
  await recordUsage(prisma, {
    orgId: input.orgId,
    eventType: "API_CALL",
    quantity: 1,
    idempotencyKey: `api:${input.apiKeyId}:${Date.now()}`,
    metadata: { path: input.path },
  }).catch(() => {});
}

export function assertApiScope(roles: string[], need: string): void {
  if (roles.includes("*") || roles.includes(need) || roles.includes(need.split(":")[0] + ":*")) return;
  throw new HttpError(403, "Missing API scope", "API_SCOPE", { need });
}
