import { Prisma, PrismaClient } from "@/generated/prisma";
import { ensureDatabaseUrlFromPgEnv } from "@/lib/database-url";
import { assertProductionWebEnv } from "@/lib/env-server";

ensureDatabaseUrlFromPgEnv();
assertProductionWebEnv();

const globalForPrisma = globalThis as unknown as {
  prismaBase?: PrismaClient;
  prismaWithRetry?: PrismaClient;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientPrismaError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return ["P1001", "P1002", "P1017"].includes(error.code);
  }

  const message = error instanceof Error ? error.message : "";
  return /prisma|database|connection|timed out|can't reach database server/i.test(message);
}

function wormAudit(model: string): never {
  throw new Error(`${model}: append-only / immutable — updates are not permitted.`);
}

const prismaBase =
  globalForPrisma.prismaBase ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

const prismaWorm = prismaBase.$extends({
  query: {
    dealAuditEvent: {
      update() {
        wormAudit("DealAuditEvent");
      },
      updateMany() {
        wormAudit("DealAuditEvent");
      },
    },
    preFundingValidationCertificate: {
      update() {
        wormAudit("PreFundingValidationCertificate");
      },
      updateMany() {
        wormAudit("PreFundingValidationCertificate");
      },
    },
  },
});

const prismaWithRetry =
  globalForPrisma.prismaWithRetry ??
  (prismaWorm.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const maxAttempts = 3;
          for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
              return await query(args);
            } catch (error) {
              const canRetry = attempt < maxAttempts && isTransientPrismaError(error);
              if (!canRetry) {
                throw error;
              }
              const waitMs = 125 * attempt;
              console.warn(
                `[DealSeal] Prisma retry ${attempt}/${maxAttempts - 1} for ${model ?? "raw"}.${operation} after transient error`,
              );
              await sleep(waitMs);
            }
          }
          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient);

export const prisma = prismaWithRetry;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaBase = prismaBase;
  globalForPrisma.prismaWithRetry = prismaWithRetry;
}
