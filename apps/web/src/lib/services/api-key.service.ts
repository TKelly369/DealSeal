import crypto from "crypto";
import { prisma } from "@/lib/db";

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function randomKeyPart(length: number) {
  return crypto.randomBytes(length).toString("hex").slice(0, length);
}

export const ApiKeyService = {
  async createApiKey(workspaceId: string, name: string, scopes: string[] = ["deals:write"]) {
    const prefix = process.env.NODE_ENV === "production" ? "ds_live_" : "ds_test_";
    const rawKey = `${prefix}${randomKeyPart(32)}`;
    const hashedKey = sha256(rawKey);
    const normalizedScopes = Array.from(new Set(scopes.map((s) => s.trim()).filter(Boolean)));
    const row = await prisma.apiKey.create({
      data: {
        workspaceId,
        name: name.trim() || "Integration Key",
        prefix,
        scopes: normalizedScopes.length > 0 ? normalizedScopes : ["deals:write"],
        hashedKey,
      },
    });
    return {
      id: row.id,
      rawKey,
      prefix: row.prefix,
      scopes: row.scopes,
    };
  },

  async validateApiKey(rawKey: string) {
    const hashed = sha256(rawKey);
    const key = await prisma.apiKey.findUnique({
      where: { hashedKey: hashed },
      include: {
        workspace: {
          include: {
            subscriptions: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });
    if (!key || key.revokedAt) return null;
    if (key.expiresAt && key.expiresAt < new Date()) return null;
    await prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });
    return {
      apiKeyId: key.id,
      workspaceId: key.workspaceId,
      scopes: key.scopes,
      workspace: key.workspace,
      subscription: key.workspace.subscriptions[0] ?? null,
    };
  },
};

