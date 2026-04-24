/**
 * One-off backfill: create GoverningRecord for LOCKED deals that predate the governing-record feature.
 *
 * DO NOT run automatically. Review output, then run in the target environment:
 *
 *   npx tsx scripts/backfill-governing-records.ts
 *
 * Requires: apps/api/.env (or env) with DATABASE_URL. Run from the repository root.
 */
import { config } from "dotenv";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TransactionState } from "@prisma/client";
import { prisma } from "../apps/api/src/lib/prisma.js";
import { backfillSingleGoverningRecordForTransaction } from "../apps/api/src/services/governing-record-service.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
config({ path: join(root, "apps", "api", ".env") });

async function main(): Promise<void> {
  const locked = await prisma.transaction.findMany({
    where: { state: TransactionState.LOCKED, governingRecord: null },
    select: { id: true, publicId: true, orgId: true },
  });
  console.log(`[backfill] Found ${locked.length} LOCKED transaction(s) with no GoverningRecord`);
  let created = 0;
  let skipped = 0;
  let errored = 0;
  for (const t of locked) {
    const r = await backfillSingleGoverningRecordForTransaction(t.id);
    console.log(`[backfill] publicId=${t.publicId} tx=${t.id} =>`, r);
    if (r.status === "created") created += 1;
    else if (r.status === "skipped") skipped += 1;
    else errored += 1;
  }
  console.log("[backfill] summary", { created, skipped, errored, total: locked.length });
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  void prisma.$disconnect();
  process.exit(1);
});
