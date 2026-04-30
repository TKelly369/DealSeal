import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prismaBase =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

function wormAuditError(): never {
  throw new Error(
    "AuditEvent is append-only (WORM): updates and deletes are not permitted.",
  );
}

/** Prisma client with strict WORM enforcement on `AuditEvent`. */
export const prisma = prismaBase.$extends({
  query: {
    auditEvent: {
      update() {
        wormAuditError();
      },
      updateMany() {
        wormAuditError();
      },
      delete() {
        wormAuditError();
      },
      deleteMany() {
        wormAuditError();
      },
      upsert() {
        wormAuditError();
      },
    },
  },
}) as unknown as PrismaClient;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prismaBase;
