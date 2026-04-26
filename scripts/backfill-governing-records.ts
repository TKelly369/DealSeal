/**
 * One-off backfill: create GoverningRecord for LOCKED deals that predate the governing-record feature.
 *
 * Idempotent: re-running only backfills where `governingRecord` is still missing. Safe to run multiple times.
 *
 * Requires explicit opt-in in non-interactive / production contexts:
 *
 *   npm run backfill:governing-records -- --confirm
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

const args = process.argv.slice(2);
const hasConfirm = args.includes("--confirm");

async function main(): Promise<void> {
  if (!hasConfirm) {
    console.warn(
      "[backfill] Refusing to run without --confirm (prevents accidental production runs). " +
        "Re-run: npm run backfill:governing-records -- --confirm",
    );
    process.exit(2);
  }
  const locked = await prisma.transaction.findMany({
    where: { state: TransactionState.LOCKED, governingRecord: null },
    select: { id: true, publicId: true, orgId: true },
  });
  const totalScanned = locked.length;
  console.log(`[backfill] Total scanned (LOCKED, no GoverningRecord): ${totalScanned}`);
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalErrored = 0;
  for (const t of locked) {
    const r = await backfillSingleGoverningRecordForTransaction(t.id);
    console.log(`[backfill] publicId=${t.publicId} tx=${t.id} =>`, r);
    if (r.status === "created") totalCreated += 1;
    else if (r.status === "skipped") totalSkipped += 1;
    else totalErrored += 1;
  }
  console.log("[backfill] summary", {
    totalScanned,
    totalCreated,
    totalSkipped,
    totalErrored,
  });
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  void prisma.$disconnect();
  process.exit(1);
});
